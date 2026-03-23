/**
 * HTML-based chat overlay with input capture and message display.
 * Opens on Enter, sends on Enter, closes on Escape.
 * All keyboard events are captured while chat is active to prevent ship movement.
 */
export class Chat {
  private container: HTMLDivElement;
  private messagesDiv: HTMLDivElement;
  private inputEl: HTMLInputElement;
  private hintEl: HTMLDivElement;
  private active = false;
  private onSend: (message: string) => void;
  private onActiveChange: (active: boolean) => void;
  private windowKeyHandler: (e: KeyboardEvent) => void;

  /** Maximum visible messages */
  private static readonly MAX_MESSAGES = 8;
  /** Message fade timeout in ms */
  private static readonly FADE_TIMEOUT = 8000;

  constructor(
    onSend: (message: string) => void,
    onActiveChange: (active: boolean) => void,
  ) {
    this.onSend = onSend;
    this.onActiveChange = onActiveChange;

    // Container
    this.container = document.createElement('div');
    this.container.id = 'chat-container';
    this.container.style.cssText = [
      'position: fixed',
      'bottom: 0',
      'left: 50%',
      'transform: translateX(-50%)',
      'z-index: 200',
      'pointer-events: none',
      'font-family: monospace',
      'font-size: 14px',
    ].join('; ');

    // Message history
    this.messagesDiv = document.createElement('div');
    this.messagesDiv.style.cssText = [
      'display: flex',
      'flex-direction: column',
      'align-items: flex-start',
      'margin-bottom: 4px',
      'max-width: 400px',
      'width: 400px',
    ].join('; ');
    this.container.appendChild(this.messagesDiv);

    // Hint text
    this.hintEl = document.createElement('div');
    this.hintEl.textContent = 'Press Enter to chat';
    this.hintEl.style.cssText = [
      'color: #888888',
      'font-size: 14px',
      'text-align: center',
      'margin-bottom: 48px',
      'width: 400px',
      'pointer-events: none',
    ].join('; ');
    this.container.appendChild(this.hintEl);

    // Input element
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.placeholder = 'Type a message...';
    this.inputEl.maxLength = 200;
    this.inputEl.style.cssText = [
      'display: none',
      'width: 400px',
      'height: 32px',
      'box-sizing: border-box',
      'background: rgba(0,0,0,0.8)',
      'border: 1px solid rgba(255,255,255,0.3)',
      'color: #ffffff',
      'font-family: monospace',
      'font-size: 14px',
      'padding: 0 8px',
      'outline: none',
      'margin-bottom: 48px',
      'pointer-events: auto',
    ].join('; ');
    this.container.appendChild(this.inputEl);

    // Input keyboard handling -- stop propagation to prevent InputManager from receiving events
    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        this.send();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.inputEl.addEventListener('keyup', (e: KeyboardEvent) => {
      e.stopPropagation();
    });

    // Window-level Enter listener to open chat when not active
    this.windowKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !this.active) {
        this.open();
      }
    };
    window.addEventListener('keydown', this.windowKeyHandler);

    document.body.appendChild(this.container);
  }

  /** Open chat input */
  open(): void {
    this.active = true;
    this.inputEl.style.display = 'block';
    this.hintEl.style.display = 'none';
    this.inputEl.focus();
    this.onActiveChange(true);
  }

  /** Close chat input without sending */
  close(): void {
    this.active = false;
    this.inputEl.style.display = 'none';
    this.inputEl.value = '';
    this.inputEl.blur();
    this.hintEl.style.display = 'block';
    this.onActiveChange(false);
  }

  /** Send the current input value and close */
  send(): void {
    const value = this.inputEl.value.trim();
    if (value.length > 0) {
      this.onSend(value);
    }
    this.inputEl.value = '';
    this.close();
  }

  /** Add a message to the chat display */
  addMessage(name: string, message: string, color?: string): void {
    const msgEl = document.createElement('div');
    msgEl.style.cssText = [
      'background: rgba(0,0,0,0.5)',
      'padding: 2px 6px',
      'margin: 1px 0',
      'transition: opacity 1s',
      'opacity: 1',
    ].join('; ');

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${name}: `;
    nameSpan.style.color = color || '#ffffff';
    nameSpan.style.fontWeight = '600';

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    textSpan.style.color = '#ffffff';

    msgEl.appendChild(nameSpan);
    msgEl.appendChild(textSpan);
    this.messagesDiv.appendChild(msgEl);

    // Remove oldest if exceeding max
    while (this.messagesDiv.children.length > Chat.MAX_MESSAGES) {
      this.messagesDiv.removeChild(this.messagesDiv.children[0]);
    }

    // Fade after timeout
    setTimeout(() => {
      msgEl.style.opacity = '0';
      // Remove from DOM after fade completes
      setTimeout(() => {
        if (msgEl.parentNode) {
          msgEl.parentNode.removeChild(msgEl);
        }
      }, 1000);
    }, Chat.FADE_TIMEOUT);
  }

  /** Check if chat is currently active */
  isActive(): boolean {
    return this.active;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.windowKeyHandler);
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
