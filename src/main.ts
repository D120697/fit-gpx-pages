import './style.css';
import { convertTrackPointsToWgs84 } from './lib/coords';
import { downloadFile } from './lib/download';
import { convertFitFileToWgs84 } from './lib/fit-binary';
import { parseFitFile, type CoordSystem, type FitSummary, type TrackPoint } from './lib/fit';

interface ConversionResult {
  points: TrackPoint[];
  summary: FitSummary;
  fitBytes: Uint8Array;
}

const COORD_LABELS: Record<CoordSystem, string> = {
  WGS84: 'WGS84（国际坐标）',
  GCJ02: 'GCJ-02（高德 / 腾讯）',
  BD09: 'BD-09（百度）',
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('找不到应用挂载节点 #app');
}

app.innerHTML = `
  <div class="shell">
    <header class="hero">
      <div>
        <span class="hero-badge">GitHub Pages Ready</span>
        <h1>FIT → FIT 坐标修正器</h1>
        <p class="hero-copy">
          直接在浏览器里读取 <code>.fit</code>，仅转换其中的中国坐标（GCJ-02 / BD-09）到 <strong>WGS84</strong>，输出仍然是 <code>.fit</code>。
        </p>
      </div>
      <div class="privacy-card">
        <h2>隐私友好</h2>
        <p>文件只在本地浏览器处理，不上传到服务器。GitHub Pages 只负责托管页面，不碰你的运动数据。</p>
      </div>
    </header>

    <main class="layout">
      <section class="panel controls-panel">
        <div class="section-heading">
          <h2>上传与转换</h2>
          <p>推荐 Garmin / Magene / Coros / Suunto / Apple Watch 导出的 FIT 文件。</p>
        </div>

        <label class="upload-card" id="uploadCard" for="fitFile">
          <input id="fitFile" type="file" accept=".fit" hidden />
          <span class="upload-title">拖拽或点击选择 FIT 文件</span>
          <span class="upload-subtitle" id="fileMeta">未选择文件</span>
        </label>

        <div class="field-grid">
          <label class="field">
            <span>源坐标系</span>
            <select id="sourceCoord">
              <option value="WGS84">WGS84（国际坐标）</option>
              <option value="GCJ02">GCJ-02（高德 / 腾讯）</option>
              <option value="BD09">BD-09（百度）</option>
            </select>
          </label>

          <label class="field field-readonly">
            <span>输出 FIT 坐标系</span>
            <div class="readonly-value">WGS84（仅改坐标字段）</div>
          </label>
        </div>

        <div class="tips-list">
          <div class="tip-item">Garmin / Apple Watch 原始 FIT 通常已经是 <strong>WGS84</strong>。</div>
          <div class="tip-item">若点位来自高德 / 腾讯，请选择 <strong>GCJ-02 → WGS84</strong>。</div>
          <div class="tip-item">若点位来自百度，请选择 <strong>BD-09 → WGS84</strong>。</div>
        </div>

        <div class="action-row">
          <button id="convertButton" class="primary-button" type="button" disabled>开始转换</button>
          <button id="clearButton" class="ghost-button" type="button">清空</button>
        </div>

        <p class="status-banner" id="statusBanner" data-tone="info">请选择一个 FIT 文件开始。</p>
      </section>

      <section class="panel result-panel">
        <div class="section-heading">
          <h2>转换结果</h2>
          <p>成功后可直接下载修正后的 FIT，用于 Garmin Connect、Strava 等运动平台。</p>
        </div>

        <div class="summary-grid" id="summaryGrid"></div>

        <div class="notes-card" id="notesCard">
          <h3>准备就绪</h3>
          <p>上传文件后，这里会显示点位数量、起止时间、总距离与坐标处理方式。</p>
        </div>

        <div class="download-card" id="downloadCard" hidden>
          <div>
            <h3>FIT 已生成</h3>
            <p>下载的是 WGS84 坐标的 FIT 文件，其他消息字段会尽量按原样重编码并保留。</p>
          </div>
          <button id="downloadButton" class="primary-button" type="button">下载 FIT</button>
        </div>
      </section>
    </main>
  </div>
`;

const fileInput = document.querySelector<HTMLInputElement>('#fitFile')!;
const uploadCard = document.querySelector<HTMLLabelElement>('#uploadCard')!;
const fileMeta = document.querySelector<HTMLSpanElement>('#fileMeta')!;
const sourceCoord = document.querySelector<HTMLSelectElement>('#sourceCoord')!;
const convertButton = document.querySelector<HTMLButtonElement>('#convertButton')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clearButton')!;
const downloadButton = document.querySelector<HTMLButtonElement>('#downloadButton')!;
const downloadCard = document.querySelector<HTMLDivElement>('#downloadCard')!;
const statusBanner = document.querySelector<HTMLParagraphElement>('#statusBanner')!;
const summaryGrid = document.querySelector<HTMLDivElement>('#summaryGrid')!;
const notesCard = document.querySelector<HTMLDivElement>('#notesCard')!;

const state: {
  file: File | null;
  sourceCoord: CoordSystem;
  result: ConversionResult | null;
} = {
  file: null,
  sourceCoord: 'WGS84',
  result: null,
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(value?: string) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDistance(kilometers?: number) {
  if (kilometers == null || !Number.isFinite(kilometers)) {
    return '—';
  }

  return `${kilometers.toFixed(kilometers >= 100 ? 0 : 2)} km`;
}

function haversineDistanceKm(a: TrackPoint, b: TrackPoint) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const value = sinLat * sinLat
    + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function estimateDistanceKm(points: TrackPoint[]) {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += haversineDistanceKm(points[index - 1], points[index]);
  }

  return total;
}

function deriveTrackName(filename: string) {
  return filename.replace(/\.fit$/iu, '').trim() || 'converted-track';
}

function deriveOutputFilename(filename: string, sourceCoordValue: CoordSystem) {
  if (sourceCoordValue === 'WGS84') {
    return filename;
  }

  return `${deriveTrackName(filename)}_wgs84.fit`;
}

function setStatus(message: string, tone: 'info' | 'success' | 'error' = 'info') {
  statusBanner.dataset.tone = tone;
  statusBanner.textContent = message;
}

function renderSummary(result: ConversionResult | null) {
  if (!result) {
    summaryGrid.innerHTML = `
      <article class="metric-card">
        <span class="metric-label">轨迹点数</span>
        <strong class="metric-value">—</strong>
      </article>
      <article class="metric-card">
        <span class="metric-label">总距离</span>
        <strong class="metric-value">—</strong>
      </article>
      <article class="metric-card">
        <span class="metric-label">开始时间</span>
        <strong class="metric-value">—</strong>
      </article>
      <article class="metric-card">
        <span class="metric-label">结束时间</span>
        <strong class="metric-value">—</strong>
      </article>
    `;
    notesCard.innerHTML = `
      <h3>准备就绪</h3>
      <p>上传文件后，这里会显示点位数量、起止时间、总距离与坐标处理方式。</p>
    `;
    downloadCard.hidden = true;
    return;
  }

  const distance = result.summary.totalDistanceKm ?? estimateDistanceKm(result.points);
  const coordAction = state.sourceCoord === 'WGS84'
    ? '源文件按 WGS84 处理，导出为原样 FIT 文件。'
    : `已将 ${COORD_LABELS[state.sourceCoord]} 转成 WGS84。`;

  summaryGrid.innerHTML = `
    <article class="metric-card">
      <span class="metric-label">轨迹点数</span>
      <strong class="metric-value">${result.points.length.toLocaleString('zh-CN')}</strong>
    </article>
    <article class="metric-card">
      <span class="metric-label">总距离</span>
      <strong class="metric-value">${formatDistance(distance)}</strong>
    </article>
    <article class="metric-card">
      <span class="metric-label">开始时间</span>
      <strong class="metric-value">${formatDateTime(result.summary.startedAt)}</strong>
    </article>
    <article class="metric-card">
      <span class="metric-label">结束时间</span>
      <strong class="metric-value">${formatDateTime(result.summary.endedAt)}</strong>
    </article>
  `;

  notesCard.innerHTML = `
    <h3>转换说明</h3>
    <p>${coordAction}</p>
    <ul class="notes-list">
      <li>输出坐标系：<strong>WGS84</strong></li>
      <li>运动类型：<strong>${result.summary.sport ?? '未识别'}</strong></li>
      <li>文件处理方式：<strong>浏览器本地完成</strong></li>
      <li>输出文件：<strong>FIT 原样重编码，仅转换坐标相关字段并重算 CRC</strong></li>
    </ul>
  `;

  downloadCard.hidden = false;
}

function refreshFileMeta() {
  if (!state.file) {
    fileMeta.textContent = '未选择文件';
    return;
  }

  fileMeta.textContent = `${state.file.name} · ${formatFileSize(state.file.size)}`;
}

function refreshActions() {
  convertButton.disabled = state.file == null;
}

function resetResult() {
  state.result = null;
  renderSummary(null);
}

function clearSelection() {
  state.file = null;
  fileInput.value = '';
  resetResult();
  refreshFileMeta();
  refreshActions();
  setStatus('已清空，重新选择一个 FIT 文件即可。');
}

function acceptFile(file: File | null | undefined) {
  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith('.fit')) {
    setStatus('请选择 .fit 文件。', 'error');
    return;
  }

  state.file = file;
  resetResult();
  refreshFileMeta();
  refreshActions();
  setStatus(`文件已就绪：${file.name}。选择源坐标系后点击“开始转换”。`, 'info');
}

async function handleConvert() {
  if (!state.file) {
    setStatus('请先选择 FIT 文件。', 'error');
    return;
  }

  convertButton.disabled = true;
  convertButton.textContent = '转换中...';
  setStatus('正在解析并重写 FIT 文件，请稍候...', 'info');

  try {
    const parsed = await parseFitFile(state.file);

    if (!parsed.points.length) {
      throw new Error('该 FIT 文件未发现有效 GPS 轨迹点，可能是室内训练或仅包含传感器数据。');
    }

    const convertedPoints = convertTrackPointsToWgs84(parsed.points, state.sourceCoord);
    const summary: FitSummary = {
      ...parsed.summary,
      totalDistanceKm: parsed.summary.totalDistanceKm ?? estimateDistanceKm(convertedPoints),
    };
    const fitBytes = await convertFitFileToWgs84(state.file, state.sourceCoord);

    state.result = {
      points: convertedPoints,
      summary,
      fitBytes,
    };

    renderSummary(state.result);
    setStatus(`转换完成：已生成 ${convertedPoints.length.toLocaleString('zh-CN')} 个轨迹点的 FIT 文件。`, 'success');
  } catch (error) {
    resetResult();
    const message = error instanceof Error ? error.message : '转换失败，请换一个 FIT 文件再试。';
    setStatus(message, 'error');
  } finally {
    convertButton.textContent = '开始转换';
    refreshActions();
  }
}

fileInput.addEventListener('change', (event) => {
  const target = event.currentTarget as HTMLInputElement;
  acceptFile(target.files?.[0] ?? null);
});

sourceCoord.addEventListener('change', (event) => {
  const target = event.currentTarget as HTMLSelectElement;
  state.sourceCoord = target.value as CoordSystem;
  if (state.file) {
    setStatus(`源坐标系已切换为 ${COORD_LABELS[state.sourceCoord]}。`, 'info');
  }
});

convertButton.addEventListener('click', () => {
  void handleConvert();
});

clearButton.addEventListener('click', () => {
  clearSelection();
});

downloadButton.addEventListener('click', () => {
  if (!state.file || !state.result) {
    return;
  }

  downloadFile(
    state.result.fitBytes,
    deriveOutputFilename(state.file.name, state.sourceCoord),
    'application/vnd.ant.fit',
  );
});

uploadCard.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadCard.dataset.dragging = 'true';
});

uploadCard.addEventListener('dragleave', () => {
  uploadCard.dataset.dragging = 'false';
});

uploadCard.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadCard.dataset.dragging = 'false';
  acceptFile(event.dataTransfer?.files?.[0] ?? null);
});

renderSummary(null);
refreshFileMeta();
refreshActions();
