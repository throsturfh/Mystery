/** The creator name field is a DOM input. It must never remain visible once play starts. */
export function hideCreatorField(): void {
  const input = document.getElementById('creator-name') as HTMLInputElement | null;
  if (!input) return;
  input.classList.remove('show');
  input.style.display = 'none';
  input.setAttribute('aria-hidden', 'true');
  input.blur();
}

export function placeCreatorField(canvas: DOMRect, gameW: number, gameH: number): void {
  const input = document.getElementById('creator-name') as HTMLInputElement | null;
  if (!input) return;
  input.classList.add('show');
  input.style.display = 'block';
  input.setAttribute('aria-hidden', 'false');
  input.style.left = `${canvas.left + (520 / gameW) * canvas.width}px`;
  input.style.top = `${canvas.top + (108 / gameH) * canvas.height}px`;
  input.style.width = `${(420 / gameW) * canvas.width}px`;
  input.style.height = `${(48 / gameH) * canvas.height}px`;
}
