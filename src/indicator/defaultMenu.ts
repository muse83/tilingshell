import { GObject, St, Clutter } from '../gi/ext';
import SignalHandling from '../utils/signalHandling';
import Indicator from './indicator';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { getMonitors, getScalingFactorOf } from '../utils/ui';
import Settings from '../settings/settings';
import {
    SIGNAL_LAYOUTS_CHANGED,
    SIGNAL_SELECTED_CHANGED,
} from '../settings/layoutsSettings';
import {
    displayScale,
    styleWidgetForItsMonitor,
} from '../components/displayScale/gnomeDisplayScale';
import GlobalState from '../utils/globalState';
import CurrentMenu from './currentMenu';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import LayoutButton from './layoutButton';
import { logger } from '../utils/logger';
import { registerGObjectClass } from '../utils/gjs';
import { Monitor } from 'resource:///org/gnome/shell/ui/layout.js';
import Layout from '../components/layout/Layout';
import { _ } from '../translations';
import { widgetOrientation } from '../utils/gnomesupport';
import { createButton, createIconButton } from './utils';

const debug = logger('DefaultMenu');

class LayoutsRow extends St.BoxLayout {
    static {
        registerGObjectClass(this, {
            GTypeName: 'LayoutsRow',
            Signals: {
                'selected-layout': {
                    param_types: [GObject.TYPE_STRING],
                },
            },
        });
    }

    private _layoutsBox: St.BoxLayout;
    private _layoutsButtons: LayoutButton[];
    private _label: St.Label;
    private _monitor: Monitor;

    constructor(
        parent: Clutter.Actor,
        layouts: Layout[],
        selectedId: string,
        showMonitorName: boolean,
        monitor: Monitor
    ) {
        super({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            style: 'spacing: 8px',
            ...widgetOrientation(true),
        });
        this._layoutsBox = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            styleClass: 'layouts-box-layout',
        });
        this._monitor = monitor;
        this._label = new St.Label({
            text: `Monitor ${this._monitor.index + 1}`,
            styleClass: 'monitor-layouts-title',
        });
        this.add_child(this._label);
        if (!showMonitorName) this._label.hide();
        this.add_child(this._layoutsBox);

        parent.add_child(this);

        const selectedIndex = layouts.findIndex(lay => lay.id === selectedId);
        const hasGaps = Settings.get_inner_gaps(1).top > 0;

        const layoutHeight: number = 36;
        const layoutWidth: number = 64; // 16:9 ratio. -> (16*layoutHeight) / 9 and then rounded to int

        this._layoutsButtons = layouts.map((lay, ind) => {
            const btn = new LayoutButton(
                this._layoutsBox,
                lay,
                hasGaps ? 2 : 0,
                layoutHeight,
                layoutWidth
            );
            btn.connect(
                'clicked',
                () => !btn.checked && this.emit('selected-layout', lay.id)
            );
            if (ind === selectedIndex) btn.set_checked(true);
            return btn;
        });
    }

    public selectLayout(selectedId: string) {
        const selectedIndex = GlobalState.get().layouts.findIndex(
            lay => lay.id === selectedId
        );
        this._layoutsButtons.forEach((btn, ind) =>
            btn.set_checked(ind === selectedIndex)
        );
    }

    public updateMonitorName(
        showMonitorName: boolean,
        monitorsDetails: { name: string; index: number }[]
    ) {
        if (!showMonitorName) {
            this._label.hide();
            return;
        }

        this._label.show();
        const details = monitorsDetails.find(
            m => m.index === this._monitor.index
        );
        if (!details) {
            debug(`no name found for monitor ${this._monitor.index}`);
            return;
        }

        this._label.set_text(details.name);
    }
}

export default class DefaultMenu implements CurrentMenu {
    private readonly _signals: SignalHandling;
    private readonly _indicator: Indicator;

    private _layoutsRows: LayoutsRow[];
    private _container: St.BoxLayout;
    private _scalingFactor: number;
    private _children: St.Widget[];
    private _openPrefsFn: () => void;

    constructor(indicator: Indicator, openPrefsFn: () => void) {
        this._indicator = indicator;
        this._signals = new SignalHandling();
        this._openPrefsFn = openPrefsFn;
        this._children = [];
        const layoutsPopupMenu = new PopupMenu.PopupBaseMenuItem({
            style_class: 'indicator-menu-item',
        });
        this._children.push(layoutsPopupMenu);
        this._container = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            styleClass: 'default-menu-container',
            ...widgetOrientation(true),
        });
        layoutsPopupMenu.add_child(this._container);
        (this._indicator.menu as PopupMenu.PopupMenu).addMenuItem(
            layoutsPopupMenu
        );

        styleWidgetForItsMonitor(this._container);
        this._scalingFactor = getScalingFactorOf(this._container)[1];

        this._layoutsRows = [];
        this._drawLayouts();
        // update the layouts shown by the indicator when they are modified
        this._signals.connect(Settings.layouts, SIGNAL_LAYOUTS_CHANGED, () => {
            this._drawLayouts();
        });
        this._signals.connect(Settings, Settings.KEY_INNER_GAPS, () => {
            this._drawLayouts();
        });

        // if the selected layout was changed externaly, update the selected button
        this._signals.connect(Settings.layouts, SIGNAL_SELECTED_CHANGED, () => {
            this._updateScaling();
            if (this._layoutsRows.length !== getMonitors().length)
                this._drawLayouts();

            const selected_layouts = Settings.layouts.selected;
            const wsIndex =
                global.workspaceManager.get_active_workspace_index();
            getMonitors().forEach((m, index) => {
                const selectedId =
                    wsIndex < selected_layouts.length
                        ? selected_layouts[wsIndex][index]
                        : GlobalState.get().layouts[0].id;
                this._layoutsRows[index].selectLayout(selectedId);
            });
        });

        this._signals.connect(
            global.workspaceManager,
            'active-workspace-changed',
            () => {
                const selected_layouts = Settings.layouts.selected;
                const wsIndex =
                    global.workspaceManager.get_active_workspace_index();
                getMonitors().forEach((m, index) => {
                    const selectedId =
                        wsIndex < selected_layouts.length
                            ? selected_layouts[wsIndex][index]
                            : GlobalState.get().layouts[0].id;
                    this._layoutsRows[index].selectLayout(selectedId);
                });
            }
        );

        this._signals.connect(Main.layoutManager, 'monitors-changed', () => {
            if (!displayScale().isPhysical) return;

            styleWidgetForItsMonitor(this._container);

            this._updateScaling();
            if (this._layoutsRows.length !== getMonitors().length)
                this._drawLayouts();

            // compute monitors details and update labels asynchronously (if we have successful results...)
            this._computeMonitorsDetails();
        });

        // compute monitors details and update labels asynchronously (if we have successful results...)
        this._computeMonitorsDetails();

        const buttonsPopupMenu = this._buildEditingButtonsRow();
        (this._indicator.menu as PopupMenu.PopupMenu).addMenuItem(
            buttonsPopupMenu
        );
        this._children.push(buttonsPopupMenu);
    }

    // show the name of each monitor in the label of its layouts row
    private _computeMonitorsDetails() {
        if (getMonitors().length === 1) {
            this._layoutsRows.forEach(lr => lr.updateMonitorName(false, []));
            return;
        }

        const monitorsDetails = this._getMonitorsDetails();
        this._layoutsRows.forEach(lr =>
            lr.updateMonitorName(true, monitorsDetails)
        );
    }

    private _getMonitorsDetails(): { name: string; index: number }[] {
        const logicalMonitors =
            global.backend.get_monitor_manager().get_logical_monitors() ?? [];

        return logicalMonitors.flatMap(logicalMonitor => {
            const metaMonitor = logicalMonitor.get_monitors()[0];
            if (!metaMonitor) return [];
            return [
                {
                    name: metaMonitor.get_display_name(),
                    index: logicalMonitor.get_number(),
                },
            ];
        });
    }

    private _updateScaling() {
        const newScalingFactor = getScalingFactorOf(this._container)[1];
        if (this._scalingFactor === newScalingFactor) return;

        this._scalingFactor = newScalingFactor;
        this._drawLayouts();
    }

    private _buildEditingButtonsRow() {
        const buttonsBoxLayout = new St.BoxLayout({
            xAlign: Clutter.ActorAlign.CENTER,
            yAlign: Clutter.ActorAlign.CENTER,
            xExpand: true,
            yExpand: true,
            styleClass: 'buttons-box-layout',
        });

        const editLayoutsBtn = createButton(
            'edit-symbolic',
            `${_('Edit Layouts')}...`,
            this._indicator.path
        );
        editLayoutsBtn.connect('clicked', () =>
            this._indicator.openLayoutEditor()
        );
        buttonsBoxLayout.add_child(editLayoutsBtn);
        const newLayoutBtn = createButton(
            'add-symbolic',
            `${_('New Layout')}...`,
            this._indicator.path
        );
        newLayoutBtn.connect('clicked', () =>
            this._indicator.newLayoutOnClick(true)
        );
        buttonsBoxLayout.add_child(newLayoutBtn);

        const prefsBtn = createIconButton(
            'prefs-symbolic',
            this._indicator.path
        );
        prefsBtn.connect('clicked', () => {
            this._openPrefsFn();
            this._indicator.menu.toggle();
        });
        buttonsBoxLayout.add_child(prefsBtn);

        const buttonsPopupMenu = new PopupMenu.PopupBaseMenuItem({
            style_class: 'indicator-menu-item',
        });
        buttonsPopupMenu.add_child(buttonsBoxLayout);

        return buttonsPopupMenu;
    }

    private _drawLayouts() {
        const layouts = GlobalState.get().layouts;
        this._container.destroy_all_children();
        this._layoutsRows = [];

        const selected_layouts = Settings.layouts.selected;
        const ws_index = global.workspaceManager.get_active_workspace_index();
        const monitors = getMonitors();
        this._layoutsRows = monitors.map(monitor => {
            const ws_selected_layouts =
                ws_index < selected_layouts.length
                    ? selected_layouts[ws_index]
                    : [];
            const selectedId =
                monitor.index < ws_selected_layouts.length
                    ? ws_selected_layouts[monitor.index]
                    : GlobalState.get().layouts[0].id;
            const row = new LayoutsRow(
                this._container,
                layouts,
                selectedId,
                monitors.length > 1,
                monitor
            );
            row.connect(
                'selected-layout',
                (r: LayoutsRow, layoutId: string) => {
                    this._indicator.selectLayoutOnClick(
                        monitor.index,
                        layoutId
                    );
                }
            );
            return row;
        });
    }

    public destroy() {
        this._signals.disconnect();
        this._layoutsRows.forEach(lr => lr.destroy());
        this._layoutsRows = [];
        this._children.forEach(c => c.destroy());
        this._children = [];
    }
}
