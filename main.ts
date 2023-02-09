import { match } from 'assert';
import { timeStamp } from 'console';
import { link } from 'fs';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import * as path from 'path';
var PythonShell = require('python-shell');

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string,
	exportPath: string
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default',
	exportPath: ''
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {

		await this.loadSettings();



		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});


		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
enum ExportType {
	Markdown = "Markdown",
	Html = "Html",
}
interface ExportSettings {
	exportType: ExportType,
}
const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
	exportType: ExportType.Markdown,
}

class SampleModal extends Modal {
	exportSettings: ExportSettings = DEFAULT_EXPORT_SETTINGS;
	constructor(app: App) {
		super(app);
	}

	onSubmit() {
		console.log(this.exportSettings);
		let visitor = new RecursiveVisitor(this.app);
		let file = this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
		let { vault } = this.app;
		let export_root = "_test";
		vault.adapter.mkdir(export_root).catch((err) => {
			console.log(err);
		}).then(() => {
			let export_dir = path.join(export_root, file?.basename + new Date().getTime().toString());
			visitor.visit(file);
			vault.adapter.mkdir(export_dir).catch((err) => {
				console.log(err);
			}).then(() => {
				let new_files: string[];
				visitor.visited.forEach((file) => {
					let new_file = path.join(export_dir, file?.path);
					// mkdir will create all parent paths if neccessary
					// HELP: On windows, it shows the full file path as the file name
					vault.adapter.mkdir(path.dirname(new_file)).then(() => {
						this.app.vault.adapter.copy(file?.path, new_file).then();
						// console.log(file?.path);
						// console.log(new_file);
					});
					// TODO: Create dir if not exist
					// new_files.push(new_file);
					// console.log(new_file);

				});
				// this.app.vault.adapter.copy
			});
		});



	}
	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h4", { text: "Recursively export the current note with the following settings" });
		// new Setting(contentEl)
		// 	.setName("Test")
		// 	.addText((text) =>
		// 		text.onChange((value) => {
		// 			this.result = value
		// 		}));

		new Setting(contentEl)
			.setName("Test")
			.addDropdown((component) => {
				for (let type in ExportType) {
					component.addOption(type, type);
				}
				component.setValue(this.exportSettings.exportType.toString());
				component.onChange((value: string) => {
					this.exportSettings.exportType = ExportType[value as keyof typeof ExportType]
				});
			});
		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Submit")
					.setCta()
					.onClick(() => {
						this.close();
						this.onSubmit();
					}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
class RecursiveVisitor {
	app: App;
	visited: Set<TFile>;
	constructor(app: App) {
		this.app = app;
		this.visited = new Set();
	}

	visit(file?: TFile) {
		// console.log(file)
		if (!file)
			return
		let { vault } = this.app;
		let links = this.app.metadataCache.resolvedLinks[file.path]
		this.visited.add(file)
		for (let link in links) {
			let child = vault.getAbstractFileByPath(link);
			if (child && !this.visited.has(child as TFile)) {
				this.visit(child as TFile);
			}
		}
		// let { vault } = this.app;
		// vault.cachedRead(file).then(
		// 	(string) => {
		// 		console.log(string);
		// 	}
		// )
	}
}
class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;
	visitor: RecursiveVisitor;
	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;


		containerEl.createEl('h2', { text: 'Settings for my awesome plugin.' });

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Export path')
			.setDesc('Where to store the exported files')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					// console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
