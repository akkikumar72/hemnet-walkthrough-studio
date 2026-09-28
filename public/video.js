export const VIDEO_TITLE_HOLD = 0.5;
export const VIDEO_INTRO_DURATION = 1;

export function drawTourTitle(
  context,
  address,
  opacity = 1,
  background = null,
) {
  const { width, height } = context.canvas;
  context.save();
  context.globalAlpha = opacity;
  if (background) {
    const scale = Math.max(
      width / background.naturalWidth,
      height / background.naturalHeight,
    );
    const w = background.naturalWidth * scale;
    const h = background.naturalHeight * scale;
    context.drawImage(background, (width - w) / 2, (height - h) / 2, w, h);
  } else {
    context.fillStyle = "#007e47";
    context.fillRect(0, 0, width, height);
  }
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ffffff";
  context.font = "500 72px Roboto, sans-serif";
  context.fillText("3D Walkthrough", width / 2, height / 2 - 24);
  context.font = "400 44px Roboto, sans-serif";
  context.fillText(address, width / 2, height / 2 + 50, width - 200);
  context.restore();
}

// Single-track VP9 WebM, with a finite segment, exact duration, and a seek index.
// Matroska elements: https://www.matroska.org/technical/elements.html
const bytes = (n) => {
  const out = [];
  do {
    out.unshift(n % 256);
    n = Math.floor(n / 256);
  } while (n);
  return new Uint8Array(out);
};
const join = (parts) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};
const size = (n) => {
  let length = 1;
  while (n >= 2 ** (length * 7) - 1) length++;
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    out[i] = n % 256;
    n = Math.floor(n / 256);
  }
  out[0] |= 1 << (8 - length);
  return out;
};
const el = (id, data) => join([bytes(id), size(data.length), data]);
const uint = (id, n) => el(id, bytes(n));
const str = (id, text) => el(id, new TextEncoder().encode(text));
const master = (id, parts) => el(id, join(parts));
const float = (id, n) => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, n);
  return el(id, out);
};

export function muxWebM(chunks, { width, height, fps, frameCount }) {
  const header = master(0x1a45dfa3, [
    uint(0x4286, 1),
    uint(0x42f7, 1),
    uint(0x42f2, 4),
    uint(0x42f3, 8),
    str(0x4282, "webm"),
    uint(0x4287, 4),
    uint(0x4285, 2),
  ]);
  const info = master(0x1549a966, [
    uint(0x2ad7b1, 1000000),
    float(0x4489, (frameCount / fps) * 1000),
    str(0x4d80, "Walkthrough Studio"),
    str(0x5741, "Walkthrough Studio"),
  ]);
  const tracks = master(0x1654ae6b, [
    master(0xae, [
      uint(0xd7, 1),
      uint(0x73c5, 1),
      uint(0x83, 1),
      str(0x86, "V_VP9"),
      uint(0x23e383, Math.round(1e9 / fps)),
      master(0xe0, [uint(0xb0, width), uint(0xba, height)]),
    ]),
  ]);
  const clusters = [],
    cues = [];
  let blocks = [],
    clusterTime = 0,
    offset = info.length + tracks.length;
  function closeCluster() {
    if (!blocks.length) return;
    const cluster = master(0x1f43b675, [uint(0xe7, clusterTime), ...blocks]);
    cues.push(
      master(0xbb, [
        uint(0xb3, clusterTime),
        master(0xb7, [uint(0xf7, 1), uint(0xf1, offset)]),
      ]),
    );
    clusters.push(cluster);
    offset += cluster.length;
    blocks = [];
  }
  for (const chunk of chunks) {
    const ms = Math.round(chunk.timestamp / 1000);
    if (chunk.key) {
      closeCluster();
      clusterTime = ms;
    }
    const block = new Uint8Array(4 + chunk.data.length);
    block[0] = 0x81;
    new DataView(block.buffer).setInt16(1, ms - clusterTime);
    block[3] = chunk.key ? 0x80 : 0;
    block.set(chunk.data, 4);
    blocks.push(el(0xa3, block));
  }
  closeCluster();
  const cueIndex = master(0x1c53bb6b, cues);
  const length = offset + cueIndex.length;
  return new Blob(
    [
      header,
      bytes(0x18538067),
      size(length),
      info,
      tracks,
      ...clusters,
      cueIndex,
    ],
    { type: "video/webm" },
  );
}

export async function encodeTour({
  canvas,
  duration,
  draw,
  cancelled,
  progress,
}) {
  const fps = 30,
    frameCount = Math.round(duration * fps);
  const config = {
    codec: "vp09.00.40.08",
    width: 1920,
    height: 1080,
    bitrate: 18000000,
    framerate: fps,
    latencyMode: "quality",
  };
  if (
    !globalThis.VideoEncoder ||
    !(await VideoEncoder.isConfigSupported(config)).supported
  )
    throw new Error(
      "Frame-by-frame video export requires a browser with VP9 WebCodecs support. Try Chrome or export the Unreal project.",
    );
  const chunks = [];
  let failure;
  const encoder = new VideoEncoder({
    output(chunk) {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({
        data,
        timestamp: chunk.timestamp,
        key: chunk.type === "key",
      });
    },
    error(error) {
      failure = error;
    },
  });
  encoder.configure(config);
  try {
    for (let i = 0; i < frameCount; i++) {
      if (cancelled()) return null;
      if (failure) throw failure;
      // Yield to input and painting; encoding duration is independent of wall time.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (encoder.encodeQueueSize > 3) await encoder.flush();
      await draw(i / fps);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((i * 1e6) / fps),
        duration:
          Math.round(((i + 1) * 1e6) / fps) - Math.round((i * 1e6) / fps),
      });
      try {
        encoder.encode(frame, { keyFrame: i % 60 === 0 });
      } finally {
        frame.close();
      }
      if (i % 30 === 0) progress(i, frameCount);
    }
    await encoder.flush();
    if (failure) throw failure;
    if (chunks.length !== frameCount)
      throw new Error(
        "Video export returned an incomplete frame sequence. No file was saved.",
      );
    return muxWebM(chunks, { ...config, fps, frameCount });
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
}
