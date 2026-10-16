// Builds the extension's preferences dialog the way the Extensions app does and presents it
// for a few seconds. Prints FILL_OK and the first page title when the UI was built.
// The Extensions app itself does not start in the container, so this stands in for it.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Adw from 'gi://Adw?version=1';

const extPath = '/home/dev/.local/share/gnome-shell/extensions/tilingshell@ferrarodomenico.com';
Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
Adw.init();

const [, bytes] = GLib.file_get_contents(`${extPath}/metadata.json`);
const metadata = JSON.parse(new TextDecoder().decode(bytes));
metadata.path = extPath;
metadata.dir = Gio.File.new_for_path(extPath);

const mod = await import(`file://${extPath}/prefs.js`);
const prefs = new mod.default(metadata);
// the Extensions app registers the instance by uuid; mimic that so gettext() resolves
Object.getPrototypeOf(mod.default).lookupByUUID = u => (u === metadata.uuid ? prefs : null);

const win = new Adw.PreferencesWindow({ title: 'prefs-harness' });
await prefs.fillPreferencesWindow(win);
win.present();
console.log('FILL_OK visiblePage=' + (win.visible_page ? win.visible_page.title : 'none'));

const loop = new GLib.MainLoop(null, false);
GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => { loop.quit(); return GLib.SOURCE_REMOVE; });
loop.run();
console.log('DONE');
