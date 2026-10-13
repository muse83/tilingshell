import { Clutter, Shell, Meta } from '../gi/ext';

export function widgetOrientation(vertical: boolean) {
    return {
        orientation: vertical
            ? Clutter.Orientation.VERTICAL
            : Clutter.Orientation.HORIZONTAL,
    };
}

export function buildBlurEffect(sigma: number): Shell.BlurEffect {
    // The sigma in Shell.BlurEffect is replaced by radius. Since the sigma value
    // is radius / 2.0, the radius value will be sigma * 2.0.
    const effect = new Shell.BlurEffect();
    effect.set_mode(Shell.BlurMode.BACKGROUND); // blur what is behind the widget
    effect.set_brightness(1);
    effect.set_radius(sigma * 2);
    return effect;
}

export function getEventCoords(event: Clutter.Event): number[] {
    return event.get_coords();
}

export function maximizeWindow(window: Meta.Window): void {
    window.maximize();
}

export function unmaximizeWindow(window: Meta.Window): void {
    window.unmaximize();
}
