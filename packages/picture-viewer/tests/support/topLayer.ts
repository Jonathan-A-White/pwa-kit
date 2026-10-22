// jsdom has no <dialog>.showModal(): this stands in for it the way a browser behaves for what the viewer relies on.
// showModal opens the dialog, marks it modal (what ':modal' matches) and throws if it is open already; close() closes it,
// fires 'close' and gives focus back to what had it. A test that wants the old browser (no showModal) skips this.
export function installShowModal(): () => void {
  const proto = HTMLDialogElement.prototype as Partial<HTMLDialogElement> & Record<string, unknown>;
  const had = { showModal: proto.showModal, close: proto.close };
  const modal = new WeakSet<HTMLDialogElement>();
  const opener = new WeakMap<HTMLDialogElement, Element | null>();
  proto.showModal = function (this: HTMLDialogElement) {
    if (this.hasAttribute('open')) throw new DOMException('already open', 'InvalidStateError');
    this.setAttribute('open', '');
    modal.add(this);
    opener.set(this, document.activeElement);
    // a browser focuses the dialog's autofocus control, else its first focusable one
    (this.querySelector<HTMLElement>('[autofocus]') ?? this.querySelector<HTMLElement>('button'))?.focus();
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    modal.delete(this);
    (opener.get(this) as HTMLElement | null | undefined)?.focus?.();
    this.dispatchEvent(new Event('close'));
  };
  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string) {
    if (selector === ':modal') return this instanceof HTMLDialogElement && modal.has(this);
    return matches.call(this, selector);
  };
  return () => {
    Element.prototype.matches = matches;
    if (had.showModal) proto.showModal = had.showModal;
    else delete proto.showModal;
    if (had.close) proto.close = had.close;
    else delete proto.close;
  };
}
