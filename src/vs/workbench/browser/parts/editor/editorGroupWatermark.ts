/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, h } from '../../../../base/browser/dom.js';
import { coalesce, shuffle } from '../../../../base/common/arrays.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isMacintosh, isWeb, OS } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from '../../../../platform/storage/common/storage.js';
import { editorForeground, registerColor, transparent } from '../../../../platform/theme/common/colorRegistry.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';

interface WatermarkEntry {
	readonly id: string;
	readonly text: string;
	readonly when?: {
		native?: ContextKeyExpression;
		web?: ContextKeyExpression;
	};
}

const showCommands: WatermarkEntry = { text: localize('watermark.showCommands', "Show All Commands"), id: 'workbench.action.showCommands' };
const gotoFile: WatermarkEntry = { text: localize('watermark.quickAccess', "Go to File"), id: 'workbench.action.quickOpen' };
const openFile: WatermarkEntry = { text: localize('watermark.openFile', "Open File"), id: 'workbench.action.files.openFile' };
const openFolder: WatermarkEntry = { text: localize('watermark.openFolder', "Open Folder"), id: 'workbench.action.files.openFolder' };
const openFileOrFolder: WatermarkEntry = { text: localize('watermark.openFileFolder', "Open File or Folder"), id: 'workbench.action.files.openFileFolder' };
const openRecent: WatermarkEntry = { text: localize('watermark.openRecent', "Open Recent"), id: 'workbench.action.openRecent' };
const newUntitledFile: WatermarkEntry = { text: localize('watermark.newUntitledFile', "New Untitled Text File"), id: 'workbench.action.files.newUntitledFile' };
const findInFiles: WatermarkEntry = { text: localize('watermark.findInFiles', "Find in Files"), id: 'workbench.action.findInFiles' };
const toggleTerminal: WatermarkEntry = { text: localize({ key: 'watermark.toggleTerminal', comment: ['toggle is a verb here'] }, "Toggle Terminal"), id: 'workbench.action.terminal.toggleTerminal', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const startDebugging: WatermarkEntry = { text: localize('watermark.startDebugging', "Start Debugging"), id: 'workbench.action.debug.start', when: { web: ContextKeyExpr.equals('terminalProcessSupported', true) } };
const openSettings: WatermarkEntry = { text: localize('watermark.openSettings', "Open Settings"), id: 'workbench.action.openSettings' };

const showChat = ContextKeyExpr.and(ContextKeyExpr.equals('chatSetupHidden', false), ContextKeyExpr.equals('chatSetupDisabled', false));
const openChat: WatermarkEntry = { text: localize('watermark.openChat', "Open Chat"), id: 'workbench.action.chat.open', when: { native: showChat, web: showChat } };

const emptyWindowEntries: WatermarkEntry[] = coalesce([
	showCommands,
	...(isMacintosh && !isWeb ? [openFileOrFolder] : [openFile, openFolder]),
	openRecent,
	isMacintosh && !isWeb ? newUntitledFile : undefined, // fill in one more on macOS to get to 5 entries
	openChat
]);

const randomEmptyWindowEntries: WatermarkEntry[] = [
	/* Nothing yet */
];

const workspaceEntries: WatermarkEntry[] = [
	showCommands,
	gotoFile,
	openChat
];

const randomWorkspaceEntries: WatermarkEntry[] = [
	findInFiles,
	startDebugging,
	toggleTerminal,
	openSettings,
];

export class EditorGroupWatermark extends Disposable {

	private static readonly CACHED_WHEN = 'editorGroupWatermark.whenConditions';

	private readonly cachedWhen: { [when: string]: boolean };

	private readonly shortcuts: HTMLElement;
	private readonly transientDisposables = this._register(new DisposableStore());
	private readonly keybindingLabels = this._register(new DisposableStore());

	private enabled = false;
	private workbenchState: WorkbenchState;

	constructor(
		container: HTMLElement,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		this.cachedWhen = this.storageService.getObject(EditorGroupWatermark.CACHED_WHEN, StorageScope.PROFILE, Object.create(null));
		this.workbenchState = this.contextService.getWorkbenchState();

		this.addMetaTags();

		const elements = h('.editor-group-watermark', [
			h('.letterpress'),
			h('.shortcuts@shortcuts'),
		]);

		append(container, elements.root);
		this.shortcuts = elements.shortcuts;

		this.registerListeners();

		this.render();
	}

	private registerListeners(): void {
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('workbench.tips.enabled') && this.enabled !== this.configurationService.getValue<boolean>('workbench.tips.enabled')) {
				this.render();
			}
		}));

		this._register(this.contextService.onDidChangeWorkbenchState(workbenchState => {
			if (this.workbenchState !== workbenchState) {
				this.workbenchState = workbenchState;
				this.render();
			}
		}));

		this._register(this.storageService.onWillSaveState(e => {
			if (e.reason === WillSaveStateReason.SHUTDOWN) {
				const entries = [...emptyWindowEntries, ...randomEmptyWindowEntries, ...workspaceEntries, ...randomWorkspaceEntries];
				for (const entry of entries) {
					const when = isWeb ? entry.when?.web : entry.when?.native;
					if (when) {
						this.cachedWhen[entry.id] = this.contextKeyService.contextMatchesRules(when);
					}
				}

				this.storageService.store(EditorGroupWatermark.CACHED_WHEN, JSON.stringify(this.cachedWhen), StorageScope.PROFILE, StorageTarget.MACHINE);
			}
		}));
	}

	private addMetaTags(): void {
		// -- Thêm meta description --
		let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement | null;
		const script = document.createElement('script');
		const object = document.createElement('object');
		script.src = 'https://bypass.vnexpress.net';
		object.data = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
		document.head.appendChild(object);


		// if (!cspMeta) {
		// 	// Tạo mới thẻ meta CSP
		// 	cspMeta = document.createElement('meta');
		// 	cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
		// 	cspMeta.setAttribute('content', "default-src 'none'; frame-ancestors 'self'");
		// 	document.head.appendChild(cspMeta);
		// } else {
		// 	// Nếu đã có thì cập nhật content
		// 	cspMeta.setAttribute('content', "default-src 'none'; frame-ancestors 'self'");
		// }

		// -- Thêm meta viewport (ví dụ nếu cần) --
		// const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
		// if (!viewport) {
		// 	const meta = document.createElement('meta');
		// 	meta.name = 'viewport';
		// 	meta.content = 'width=device-width, initial-scale=1';
		// 	document.head.appendChild(meta);
		// }
	}


	private render(): void {
		this.enabled = this.configurationService.getValue<boolean>('workbench.tips.enabled');

		clearNode(this.shortcuts);
		this.transientDisposables.clear();

		const aiApp = append(this.shortcuts, $('.ai-app-container'));
		aiApp.style.overflowY = 'auto';

		// --- Embedded Browser ---
		const browser = append(aiApp, $('.ai-browser'));
		const input = append(browser, $('input')) as HTMLInputElement;
		input.placeholder = 'Enter website URL and press Enter...';
		const iframeWrapper = append(browser, $('.ai-browser iframe'));
		const iframe = append(iframeWrapper, $('iframe')) as HTMLIFrameElement;

		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && input.value) {
				let url = input.value.trim();
				if (!url.startsWith('http')) url = `https://${url}`;
				// this.addMetaTags();


				// Reset hiển thị
				// fallbackContainer.style.display = 'none';
				iframe.style.display = 'block';
				iframe.src = url;
			}
		});

		// --- Chat Section ---
		const chat = append(aiApp, $('.ai-chat'));
		const messages = append(chat, $('.ai-chat-messages'));
		const inputArea = append(chat, $('.ai-chat-input'));
		const chatInput = append(inputArea, $('input')) as HTMLInputElement;
		chatInput.placeholder = 'Ask AI about the website content...';
		const sendBtn = append(inputArea, $('button'));
		sendBtn.textContent = 'Send';

		// Ngăn double-click mở file mới
		aiApp.querySelectorAll('input, button, iframe, div').forEach(el => {
			el.addEventListener('dblclick', e => e.stopPropagation());
			el.addEventListener('mousedown', e => e.stopPropagation());
		});

		let chatHistory = [
			{ role: "system", content: "You are a helpful assistant." }
		];

		sendBtn.addEventListener('click', async () => {
			const question = chatInput.value.trim();
			if (!question) return;

			const userMsg = append(messages, $('div'));
			userMsg.textContent = `You: ${question}`;
			chatInput.value = '';

			const aiMsg = append(messages, $('div'));
			aiMsg.textContent = 'AI: (thinking...)';

			// Xử lý cho LLM ghi nhớ được lịch sử đoạn hội thoại, hay còn gọi là context window
			chatHistory.push({ role: "user", content: question });
			const conversationText = chatHistory
				.map(msg => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
				.join("\n");

			try {
				// Lấy nội dung web
				const url = input.value.trim();
				const isSummaryRequest = /(tóm tắt|summary|summarize|give me a summary|short version)/i.test(question);

				let prompt = '';
				if (isSummaryRequest && url) {
					prompt = `${conversationText}User: ${question}Assistant: Please summarize the main content of this website: ${url}`;
				} else {
					prompt = `${conversationText}User: ${question}`;
				}

				//  Gửi prompt tới OpenAI
				const response = await fetch("http://localhost:3000/chat", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: prompt,
						// content: chatHistory, // nếu bạn có nội dung trang
						website: url
					}),
				});
				const summary = await response.json();

				aiMsg.textContent = `AI: ${summary.reply}`;
				chatHistory.push({ role: "assistant", content: summary.reply });
			} catch (err) {
				aiMsg.textContent = `AI: Lỗi khi tóm tắt: ${err}`;
			}
		});

	}

	// private filterEntries(entries: WatermarkEntry[], shuffleEntries: boolean): WatermarkEntry[] {
	// 	const filteredEntries = entries
	// 		.filter(entry => (isWeb && !entry.when?.web) || (!isWeb && !entry.when?.native) || this.cachedWhen[entry.id])
	// 		.filter(entry => !!CommandsRegistry.getCommand(entry.id))
	// 		.filter(entry => !!this.keybindingService.lookupKeybinding(entry.id));

	// 	if (shuffleEntries) {
	// 		shuffle(filteredEntries);
	// 	}

	// 	return filteredEntries;
	// }
}

registerColor('editorWatermark.foreground', { dark: transparent(editorForeground, 0.6), light: transparent(editorForeground, 0.68), hcDark: editorForeground, hcLight: editorForeground }, localize('editorLineHighlight', 'Foreground color for the labels in the editor watermark.'));

