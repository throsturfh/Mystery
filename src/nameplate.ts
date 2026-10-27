import { H, W } from './config';
import type { Rect } from './debug';

let submit: ((name: string) => void) | null = null;
let wired = false;

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

function wire(): void {
  if (wired) return;
  wired = true;
  const input = el<HTMLInputElement>('detective-name');
  const button = el<HTMLButtonElement>('name-confirm');
  const send = () => submit?.(input.value);
  button.addEventListener('click', send);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      send();
    }
  });
}

export function setNameError(message: string): void {
  el<HTMLParagraphElement>('name-error').textContent = message;
}

export function showNameplate(canvas: HTMLCanvasElement, rect: Rect, onSubmit: (name: string) => void): void {
  wire();
  submit = onSubmit;
  const plate = el<HTMLDivElement>('nameplate');
  plate.hidden = false;
  placeNameplate(canvas, rect);
  const input = el<HTMLInputElement>('detective-name');
  window.setTimeout(() => input.focus(), 60);
}

export function hideNameplate(): void {
  const plate = document.getElementById('nameplate');
  if (plate) plate.hidden = true;
  setNameError('');
  submit = null;
}

export function placeNameplate(canvas: HTMLCanvasElement, rect: Rect): void {
  const plate = document.getElementById('nameplate');
  if (!plate || plate.hidden) return;
  const box = canvas.getBoundingClientRect();
  const sx = box.width / W;
  const sy = box.height / H;
  plate.style.left = `${box.left + rect.x * sx}px`;
  plate.style.top = `${box.top + rect.y * sy}px`;
  plate.style.width = `${rect.w * sx}px`;
}
