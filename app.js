const PDF_TILE_WIDTH = 1240;
const PDF_TILE_HEIGHT = 1754;

const frameDefinitions = [
  {
    name: 'Clássica',
    src: FRAME_DATA.classica,
    visible: { x: 61, y: 79, width: 1024, height: 1199 },
    opening: { x: 125, y: 134, width: 889, height: 913 },
  },
  {
    name: 'Retrô',
    src: FRAME_DATA.retro,
    visible: { x: 39, y: 25, width: 1069, height: 1308 },
    opening: { x: 98, y: 102, width: 953, height: 972 },
  },
  {
    name: 'Colorida',
    src: FRAME_DATA.colorida,
    visible: { x: 46, y: 57, width: 1050, height: 1263 },
    opening: { x: 101, y: 135, width: 939, height: 950 },
  },
];

const state = {
  frames: frameDefinitions.map((definition) => ({ ...definition, image: null })),
  selectedFrame: 0,
  photos: [null, null, null, null],
  activePhoto: 0,
};

const elements = {
  frameOptions: document.getElementById('frameOptions'),
  photoInput: document.getElementById('photoInput'),
  uploadZone: document.getElementById('uploadZone'),
  photoSlots: document.getElementById('photoSlots'),
  photoCount: document.getElementById('photoCount'),
  error: document.getElementById('errorMessage'),
  editorCanvas: document.getElementById('editorCanvas'),
  editorEmpty: document.getElementById('editorEmpty'),
  editorSubtitle: document.getElementById('editorSubtitle'),
  editorBadge: document.getElementById('editorBadge'),
  zoomRange: document.getElementById('zoomRange'),
  zoomOutput: document.getElementById('zoomOutput'),
  horizontalRange: document.getElementById('horizontalRange'),
  verticalRange: document.getElementById('verticalRange'),
  replaceButton: document.getElementById('replaceButton'),
  replaceInput: document.getElementById('replaceInput'),
  removeButton: document.getElementById('removeButton'),
  sheetCanvas: document.getElementById('sheetCanvas'),
  exportStatus: document.getElementById('exportStatus'),
  downloadButton: document.getElementById('downloadButton'),
  downloadLink: document.getElementById('downloadLink'),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function showError(message = '') {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível abrir uma imagem.'));
    image.src = source;
  });
}

async function loadFrames() {
  const results = await Promise.allSettled(state.frames.map((frame) => loadImage(frame.src)));
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') state.frames[index].image = result.value;
  });
  if (results.some((result) => result.status === 'rejected')) {
    showError('Uma moldura não abriu. Atualize a página e tente novamente.');
  }
  renderFrameOptions();
  renderCanvases();
  updateStatus();
}

function renderFrameOptions() {
  elements.frameOptions.replaceChildren();
  state.frames.forEach((frame, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `frame-option${index === state.selectedFrame ? ' is-selected' : ''}`;
    button.setAttribute('aria-pressed', String(index === state.selectedFrame));
    button.setAttribute('aria-label', `Escolher moldura ${frame.name}`);

    const imageWrap = document.createElement('span');
    imageWrap.className = 'frame-image';
    const image = document.createElement('img');
    image.src = frame.src;
    image.alt = '';
    imageWrap.append(image);

    const name = document.createElement('span');
    name.textContent = frame.name;
    button.append(imageWrap, name);
    button.addEventListener('click', () => {
      state.selectedFrame = index;
      renderFrameOptions();
      renderCanvases();
      updateStatus();
    });
    elements.frameOptions.append(button);
  });
}

function renderPhotoSlots() {
  elements.photoSlots.replaceChildren();
  state.photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `photo-slot${index === state.activePhoto ? ' is-active' : ''}`;
    button.setAttribute('aria-label', photo ? `Ajustar foto ${index + 1}` : `Adicionar foto ${index + 1}`);
    button.setAttribute('aria-pressed', String(index === state.activePhoto));

    const number = document.createElement('span');
    number.className = 'slot-number';
    number.textContent = String(index + 1);
    button.append(number);
    if (photo) {
      const thumbnail = document.createElement('img');
      thumbnail.src = photo.url;
      thumbnail.alt = '';
      button.append(thumbnail);
    } else {
      const plus = document.createElement('span');
      plus.className = 'slot-plus';
      plus.textContent = '+';
      button.append(plus);
    }
    button.addEventListener('click', () => {
      state.activePhoto = index;
      renderPhotoSlots();
      updateEditorControls();
      renderCanvases();
      if (!photo) elements.photoInput.click();
    });
    elements.photoSlots.append(button);
  });
}

async function addPhotos(files) {
  showError();
  const images = [...files].filter((file) => file.type.startsWith('image/'));
  const emptySlots = [state.activePhoto, 0, 1, 2, 3]
    .filter((index, position, array) => array.indexOf(index) === position && !state.photos[index]);

  if (!emptySlots.length) {
    showError('As quatro posições já estão preenchidas. Remova ou troque uma foto.');
    return;
  }
  if (images.length > emptySlots.length) {
    showError(`Há espaço para mais ${emptySlots.length} foto${emptySlots.length === 1 ? '' : 's'}. As primeiras foram adicionadas.`);
  }
  let added = 0;
  for (const file of images.slice(0, emptySlots.length)) {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      state.photos[emptySlots[added]] = { image, url, zoom: 1, panX: 0.5, panY: 0.5 };
      added++;
    } catch {
      URL.revokeObjectURL(url);
      showError(`Não consegui abrir ${file.name}. Escolha uma foto JPG, PNG ou WebP.`);
    }
  }
  if (added) state.activePhoto = emptySlots[0];
  renderPhotoSlots();
  updateEditorControls();
  renderCanvases();
  updateStatus();
}

function framePlacement(frame, width, height) {
  return {
    x: 0,
    y: 0,
    scaleX: width / frame.visible.width,
    scaleY: height / frame.visible.height,
    frameWidth: width,
    frameHeight: height,
  };
}

function photoGeometry(photo, width, height) {
  const scale = Math.max(width / photo.image.naturalWidth, height / photo.image.naturalHeight) * photo.zoom;
  const drawWidth = photo.image.naturalWidth * scale;
  const drawHeight = photo.image.naturalHeight * scale;
  return {
    drawWidth,
    drawHeight,
    offsetX: -(drawWidth - width) * photo.panX,
    offsetY: -(drawHeight - height) * photo.panY,
  };
}

function apertureRect(frame, placement) {
  return {
    x: placement.x + (frame.opening.x - frame.visible.x) * placement.scaleX,
    y: placement.y + (frame.opening.y - frame.visible.y) * placement.scaleY,
    width: frame.opening.width * placement.scaleX,
    height: frame.opening.height * placement.scaleY,
  };
}

function drawTile(context, x, y, width, height, photo) {
  context.fillStyle = '#ffffff';
  context.fillRect(x, y, width, height);
  const frame = state.frames[state.selectedFrame];
  if (!frame.image) return;
  const placement = framePlacement(frame, width, height);
  const opening = apertureRect(frame, placement);

  if (photo) {
    const geometry = photoGeometry(photo, opening.width, opening.height);
    context.save();
    context.beginPath();
    context.rect(x + opening.x, y + opening.y, opening.width, opening.height);
    context.clip();
    context.drawImage(
      photo.image,
      x + opening.x + geometry.offsetX,
      y + opening.y + geometry.offsetY,
      geometry.drawWidth,
      geometry.drawHeight,
    );
    context.restore();
  }
  context.drawImage(
    frame.image,
    frame.visible.x,
    frame.visible.y,
    frame.visible.width,
    frame.visible.height,
    x + placement.x,
    y + placement.y,
    placement.frameWidth,
    placement.frameHeight,
  );
}

function renderCanvases() {
  elements.downloadLink.hidden = true;
  const editor = elements.editorCanvas;
  const editorContext = editor.getContext('2d');
  drawTile(editorContext, 0, 0, editor.width, editor.height, state.photos[state.activePhoto]);
  elements.editorEmpty.hidden = Boolean(state.photos[state.activePhoto]);

  const sheet = elements.sheetCanvas;
  const sheetContext = sheet.getContext('2d');
  const tileWidth = sheet.width / 2;
  const tileHeight = sheet.height / 2;
  state.photos.forEach((photo, index) => {
    const x = (index % 2) * tileWidth;
    const y = Math.floor(index / 2) * tileHeight;
    drawTile(sheetContext, x, y, tileWidth, tileHeight, photo);
    if (!photo) {
      sheetContext.fillStyle = '#b6afa6';
      sheetContext.textAlign = 'center';
      sheetContext.font = '20px Georgia';
      sheetContext.fillText(`Foto ${index + 1}`, x + tileWidth / 2, y + tileHeight / 2);
    }
  });
}

function updateEditorControls() {
  const photo = state.photos[state.activePhoto];
  elements.editorBadge.textContent = `Foto ${state.activePhoto + 1} de 4`;
  elements.editorSubtitle.textContent = photo ? 'Arraste ou use os controles para encontrar o melhor enquadramento.' : 'Selecione uma foto para começar.';
  for (const control of [elements.zoomRange, elements.horizontalRange, elements.verticalRange, elements.replaceButton, elements.removeButton]) {
    control.disabled = !photo;
  }
  elements.zoomRange.value = photo?.zoom ?? 1;
  elements.horizontalRange.value = Math.round((photo?.panX ?? 0.5) * 100);
  elements.verticalRange.value = Math.round((photo?.panY ?? 0.5) * 100);
  elements.zoomOutput.value = `${(photo?.zoom ?? 1).toFixed(2).replace('.', ',')}×`;
}

function updateStatus() {
  const count = state.photos.filter(Boolean).length;
  elements.photoCount.textContent = `${count} de 4`;
  const ready = count === 4 && Boolean(state.frames[state.selectedFrame].image);
  elements.downloadButton.disabled = !ready;
  elements.exportStatus.textContent = ready ? 'Tudo pronto para imprimir' : `Faltam ${4 - count} foto${4 - count === 1 ? '' : 's'} para completar a folha`;
}

function syncAdjustments() {
  const photo = state.photos[state.activePhoto];
  if (!photo) return;
  photo.zoom = Number(elements.zoomRange.value);
  photo.panX = Number(elements.horizontalRange.value) / 100;
  photo.panY = Number(elements.verticalRange.value) / 100;
  updateEditorControls();
  renderCanvases();
}

for (const control of [elements.zoomRange, elements.horizontalRange, elements.verticalRange]) {
  control.addEventListener('input', syncAdjustments);
}
elements.replaceButton.addEventListener('click', () => elements.replaceInput.click());
elements.replaceInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const previous = state.photos[state.activePhoto];
    state.photos[state.activePhoto] = { image, url, zoom: 1, panX: 0.5, panY: 0.5 };
    if (previous) URL.revokeObjectURL(previous.url);
    showError();
    renderPhotoSlots();
    updateEditorControls();
    renderCanvases();
    updateStatus();
  } catch {
    URL.revokeObjectURL(url);
    showError(`Não consegui abrir ${file.name}.`);
  }
});
elements.removeButton.addEventListener('click', () => {
  const photo = state.photos[state.activePhoto];
  if (!photo) return;
  URL.revokeObjectURL(photo.url);
  state.photos[state.activePhoto] = null;
  renderPhotoSlots();
  updateEditorControls();
  renderCanvases();
  updateStatus();
});

let drag = null;
elements.editorCanvas.addEventListener('pointerdown', (event) => {
  const photo = state.photos[state.activePhoto];
  const frame = state.frames[state.selectedFrame];
  if (!photo || !frame.image) return;
  const canvas = elements.editorCanvas;
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  const pointX = (event.clientX - bounds.left) * scaleX;
  const pointY = (event.clientY - bounds.top) * scaleY;
  const opening = apertureRect(frame, framePlacement(frame, canvas.width, canvas.height));
  if (pointX < opening.x || pointX > opening.x + opening.width || pointY < opening.y || pointY > opening.y + opening.height) return;

  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, photo, opening, scaleX, scaleY };
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});
elements.editorCanvas.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const geometry = photoGeometry(drag.photo, drag.opening.width, drag.opening.height);
  const deltaX = (event.clientX - drag.x) * drag.scaleX;
  const deltaY = (event.clientY - drag.y) * drag.scaleY;
  if (geometry.drawWidth > drag.opening.width + 0.1) {
    drag.photo.panX = clamp(drag.photo.panX - deltaX / (geometry.drawWidth - drag.opening.width), 0, 1);
  }
  if (geometry.drawHeight > drag.opening.height + 0.1) {
    drag.photo.panY = clamp(drag.photo.panY - deltaY / (geometry.drawHeight - drag.opening.height), 0, 1);
  }
  drag.x = event.clientX;
  drag.y = event.clientY;
  updateEditorControls();
  renderCanvases();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  elements.editorCanvas.addEventListener(name, () => { drag = null; });
}

elements.photoInput.addEventListener('change', async (event) => {
  await addPhotos(event.target.files);
  event.target.value = '';
});
for (const name of ['dragenter', 'dragover']) {
  elements.uploadZone.addEventListener(name, (event) => {
    event.preventDefault();
    elements.uploadZone.classList.add('is-dragging');
  });
}
for (const name of ['dragleave', 'drop']) {
  elements.uploadZone.addEventListener(name, (event) => {
    event.preventDefault();
    elements.uploadZone.classList.remove('is-dragging');
  });
}
elements.uploadZone.addEventListener('drop', (event) => addPhotos(event.dataTransfer.files));

function jpegBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Não foi possível preparar uma das fotos para o PDF.'));
        return;
      }
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/jpeg', 0.97);
  });
}

function createPdf(images) {
  const encoder = new TextEncoder();
  const pieces = [];
  const offsets = new Array(9).fill(0);
  let length = 0;
  const write = (piece) => {
    const bytes = typeof piece === 'string' ? encoder.encode(piece) : piece;
    pieces.push(bytes);
    length += bytes.length;
  };
  const startObject = (number) => {
    offsets[number] = length;
    write(`${number} 0 obj\n`);
  };
  const endObject = () => write('endobj\n');

  write('%PDF-1.4\n');
  startObject(1);
  write('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();
  startObject(2);
  write('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
  endObject();
  startObject(3);
  write('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Im1 5 0 R /Im2 6 0 R /Im3 7 0 R /Im4 8 0 R >> >> /Contents 4 0 R >>\n');
  endObject();

  const tileWidth = 297.6378;
  const tileHeight = 420.9449;
  const commands = images.map((_, index) => {
    const x = index % 2 ? tileWidth : 0;
    const y = index < 2 ? tileHeight : 0;
    return `q ${tileWidth} 0 0 ${tileHeight} ${x} ${y} cm /Im${index + 1} Do Q\n`;
  }).join('');
  const contentBytes = encoder.encode(commands);
  startObject(4);
  write(`<< /Length ${contentBytes.length} >>\nstream\n`);
  write(contentBytes);
  write('\nendstream\n');
  endObject();

  images.forEach((image, index) => {
    startObject(index + 5);
    write(`<< /Type /XObject /Subtype /Image /Width ${PDF_TILE_WIDTH} /Height ${PDF_TILE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
    write(image);
    write('\nendstream\n');
    endObject();
  });

  const crossReferenceOffset = length;
  write('xref\n0 9\n0000000000 65535 f \n');
  for (let number = 1; number <= 8; number++) {
    write(`${String(offsets[number]).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF\n`);
  return new Blob(pieces, { type: 'application/pdf' });
}

let lastPdfUrl = null;
elements.downloadButton.addEventListener('click', async () => {
  if (state.photos.some((photo) => !photo) || !state.frames[state.selectedFrame].image) return;
  showError();
  elements.downloadButton.disabled = true;
  elements.exportStatus.textContent = 'Preparando o PDF…';
  try {
    const images = [];
    for (const photo of state.photos) {
      const canvas = document.createElement('canvas');
      canvas.width = PDF_TILE_WIDTH;
      canvas.height = PDF_TILE_HEIGHT;
      drawTile(canvas.getContext('2d'), 0, 0, canvas.width, canvas.height, photo);
      images.push(await jpegBytes(canvas));
    }
    const pdfUrl = URL.createObjectURL(createPdf(images));
    if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl);
    lastPdfUrl = pdfUrl;
    elements.downloadLink.href = pdfUrl;
    elements.downloadLink.hidden = false;
    elements.downloadLink.click();
  } catch (error) {
    showError('Não consegui gerar o PDF. Tente usar fotos JPG, PNG ou WebP e verifique o espaço livre no dispositivo.');
    console.error(error);
  } finally {
    updateStatus();
  }
});

renderFrameOptions();
renderPhotoSlots();
updateEditorControls();
renderCanvases();
updateStatus();
loadFrames();
