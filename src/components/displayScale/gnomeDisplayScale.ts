import { St } from '../../gi/ext';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { enableScalingFactorSupport } from '../../utils/ui';
import { DisplayScale } from './displayScale';

let instance: DisplayScale | null = null;
let themeContext: St.ThemeContext | null = null;
let signalId = 0;

const themeContextOfStage = () => St.ThemeContext.get_for_stage(global.stage);

/** The shell-backed display scale. Call enableDisplayScale first to get change notifications. */
export const displayScale = (): DisplayScale => {
    if (!instance)
        instance = new DisplayScale({
            themeScale: () => themeContextOfStage().scaleFactor,
            monitorScale: index => global.display.get_monitor_scale(index),
        });
    return instance;
};

export const enableDisplayScale = () => {
    disableDisplayScale();
    const scale = displayScale();
    themeContext = themeContextOfStage();
    signalId = themeContext.connect('notify::scale-factor', () =>
        scale.refresh()
    );
    scale.refresh();
};

export const disableDisplayScale = () => {
    if (themeContext && signalId) themeContext.disconnect(signalId);
    themeContext = null;
    signalId = 0;
    instance = null;
};

/** Style a widget with the scale of a monitor (nothing under logical scaling). */
export const styleWidgetForMonitor = (
    widget: St.Widget,
    monitorIndex: number
) =>
    enableScalingFactorSupport(
        widget,
        displayScale().styleScaleOf(monitorIndex)
    );

/** Same, for the monitor the widget is on (the primary one if it is on none). */
export const styleWidgetForItsMonitor = (widget: St.Widget) => {
    const monitor = Main.layoutManager.findMonitorForActor(widget);
    styleWidgetForMonitor(
        widget,
        monitor?.index ?? Main.layoutManager.primaryIndex
    );
};
