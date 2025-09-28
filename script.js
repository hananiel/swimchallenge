document.addEventListener('DOMContentLoaded', function() {
    const GOAL_YARDS = 8800;
    const completedYardsInput = document.getElementById('completedYards');
    const generateBtn = document.getElementById('generateBtn');
    const medalContainer = document.getElementById('medal-container');
    const swimmer = document.getElementById('swimmer');
    const medal = document.getElementById('medal');
    const progressBar = document.getElementById('progressBar');
    const currentYardsSpan = document.getElementById('currentYards');
    const targetYardsSpan = document.getElementById('targetYards');
    const gifOutput = document.getElementById('gifOutput');
    const downloadLink = document.getElementById('downloadGif');
    const exportVideoBtn = document.getElementById('exportVideoBtn');
    const downloadVideo = document.getElementById('downloadVideo');
    const shareGifBtn = document.getElementById('shareGifBtn');
    const shareVideoBtn = document.getElementById('shareVideoBtn');
    const PATH_KEYFRAMES = [
        { t: 0.00, x: 102, y: 345 },
        { t: 0.25, x: 167, y: 352 },
        { t: 0.50, x: 233, y: 388 },
        { t: 0.75, x: 294, y: 379 },
        { t: 1.00, x: 344, y: 367 }
    ];
    // The swimmer's visual center offset (provided): center is at (54, 24) from the image's top-left
    const SWIMMER_CENTER_OFFSET = { x: 54, y: 24 };
    // Overlay elements for percentage (bottom-right) and yards (bottom-left)
    let overlayPctEl, overlayYardsEl;
    
    // Fixed goal yards
    targetYardsSpan.textContent = GOAL_YARDS;
    
    // Live update preview when completed yards changes
    completedYardsInput.addEventListener('input', function() {
        let yards = parseInt(this.value) || 0;
        yards = Math.max(0, Math.min(GOAL_YARDS, yards));
        this.value = yards;
        updateProgress(yards, GOAL_YARDS);
    });

    // Generate GIF button click handler
    generateBtn.addEventListener('click', generateProgressGif);
    // Export video button click handler
    if (exportVideoBtn) exportVideoBtn.addEventListener('click', exportProgressVideo);
    // Save GIF to default location
    if (downloadLink) downloadLink.addEventListener('click', () => downloadLink.click());
    // Save video to default location
    if (downloadVideo) downloadVideo.addEventListener('click', () => downloadVideo.click());

    function waitForImages() {
        const images = [medal, swimmer];
        const loading = images
            .filter(img => !img.complete || (img.naturalWidth === 0))
            .map(img => new Promise(resolve => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
            }));
        return Promise.all(loading);
    }
    async function exportProgressVideo() {
        let completedYards = parseInt(completedYardsInput.value) || 0;
        completedYards = Math.max(0, Math.min(GOAL_YARDS, completedYards));
        const totalFrames = 40; // keep in sync with GIF
        const pauseFrames = 12; // Additional frames showing the final completed state
        const fps = 20; // 50ms per frame

        if (!exportVideoBtn || !downloadVideo) return;

        // Show loading state
        exportVideoBtn.disabled = true;
        const originalBtnText = exportVideoBtn.textContent;
        exportVideoBtn.innerHTML = 'Exporting... <span class="loading"></span>';
        gifOutput.innerHTML = '';
        downloadVideo.style.display = 'none';

        try {
            await waitForImages();

            // Prepare offscreen canvas at fixed natural medal dimensions
            const width = MEDAL_NATURAL_W;
            const height = MEDAL_NATURAL_H;
            const offscreen = document.createElement('canvas');
            offscreen.width = width;
            offscreen.height = height;
            const ctx = offscreen.getContext('2d');
            ctx.imageSmoothingEnabled = true;

            // Frame drawer mirrors the GIF one (white background + overlays)
            function drawFrame(atYards) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(medal, 0, 0, MEDAL_NATURAL_W, MEDAL_NATURAL_H);

                const progress = Math.min(atYards / GOAL_YARDS, 1);
                const pos = getPositionForProgress(progress);
                const drawX = Math.round(pos.x - SWIMMER_CENTER_OFFSET.x);
                const drawY = Math.round(pos.y - SWIMMER_CENTER_OFFSET.y);
                const targetW = Math.round(swimmer.naturalWidth || 94);
                const targetH = Math.round(swimmer.naturalHeight || 62);
                ctx.drawImage(swimmer, Math.round(drawX), Math.round(drawY), targetW, targetH);

                const pctText = `${Math.round(progress * 100)}%`;
                const yardsText = `${Math.round(atYards)} / ${GOAL_YARDS} yards`;
                ctx.save();
                ctx.font = '700 20px Segoe UI, system-ui, Arial';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillStyle = '#000000';
                ctx.fillText(yardsText, 10, height - 8);
                const pctWidth = ctx.measureText(pctText).width;
                ctx.fillText(pctText, Math.round(width - 10 - pctWidth), height - 8);
                ctx.restore();
            }

            // Record the canvas - use MP4 format
            const mp4Candidates = [
                'video/mp4;codecs=h264',
                'video/mp4;codecs=avc1',
                'video/mp4'
            ];

            let mimeType = '';
            for (const m of mp4Candidates) {
                if (MediaRecorder.isTypeSupported(m)) {
                    mimeType = m;
                    break;
                }
            }

            if (!mimeType) {
                throw new Error('No supported MP4 format found');
            }

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

            const recordingDone = new Promise((resolve) => {
                recorder.onstop = () => resolve();
            });

            recorder.start();

            // Draw main animation frames
            for (let i = 0; i <= totalFrames; i++) {
                const progress = i / totalFrames;
                const atYards = Math.round(progress * completedYards);
                drawFrame(atYards);
                await new Promise(r => setTimeout(r, 1000 / fps));
            }

            // Draw pause frames with the final completed state
            const finalYards = completedYards;
            for (let i = 0; i < pauseFrames; i++) {
                drawFrame(finalYards);
                await new Promise(r => setTimeout(r, 1000 / fps));
            }

            recorder.stop();
            await recordingDone;

            const blob = new Blob(chunks, { type: mimeType || 'video/mp4' });
            const url = URL.createObjectURL(blob);

            // Preview video element
            const videoEl = document.createElement('video');
            videoEl.controls = true;
            videoEl.loop = true;
            videoEl.style.maxWidth = '100%';
            videoEl.src = url;
            gifOutput.innerHTML = '';
            gifOutput.appendChild(videoEl);

            // Simple download setup
            downloadVideo.href = url;
            downloadVideo.download = `swim-progress-${completedYards}-of-${GOAL_YARDS}yds.mp4`;
            downloadVideo.style.display = 'inline-block';

        } catch (err) {
            console.error('Error exporting video:', err);
            gifOutput.innerHTML = '<p style="color: red;">Could not export video in this environment.</p>';
        } finally {
            exportVideoBtn.disabled = false;
            exportVideoBtn.textContent = originalBtnText || 'Export Video (MP4)';
        }
    }

    // Scan an image for exact RGB matches
    function imageContainsColor(img, rgb) {
        try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx2 = c.getContext('2d');
            ctx2.drawImage(img, 0, 0);
            const data = ctx2.getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === rgb.r && data[i + 1] === rgb.g && data[i + 2] === rgb.b) {
                    return true;
                }
            }
        } catch (_) {
            // If tainted, assume color absent to avoid false positives
            return false;
        }
        return false;
    }

    function hexToRgb(hex) {
        const v = hex.startsWith('#') ? hex.slice(1) : hex;
        const int = parseInt(v, 16);
        return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
    }

    function rgbToInt(rgb) {
        return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
    }

    // Pick a chroma key color not present in medal or swimmer
    function pickUnusedChromaKey() {
        if (CHROMA_KEY) return CHROMA_KEY;
        const candidates = ['#ff00ff', '#00ff00', '#00ffff', '#ff9900'];
        for (const css of candidates) {
            const rgb = hexToRgb(css);
            const medalHas = imageContainsColor(medal, rgb);
            const swimmerHas = imageContainsColor(swimmer, rgb);
            if (!medalHas && !swimmerHas) {
                CHROMA_KEY = { css, int: rgbToInt(rgb) };
                break;
            }
        }
        // Fallback if all found (unlikely): use magenta
        if (!CHROMA_KEY) {
            const rgb = hexToRgb('#ff00ff');
            CHROMA_KEY = { css: '#ff00ff', int: rgbToInt(rgb) };
        }
        return CHROMA_KEY;
    }

    function ensureOverlays() {
        if (!overlayPctEl) {
            overlayPctEl = document.createElement('div');
            overlayPctEl.style.position = 'absolute';
            overlayPctEl.style.right = '10px';
            overlayPctEl.style.bottom = '8px';
            overlayPctEl.style.color = '#ffffff';
            overlayPctEl.style.font = '700 16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
            overlayPctEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)';
            overlayPctEl.style.pointerEvents = 'none';
            medalContainer.appendChild(overlayPctEl);
        }
        if (!overlayYardsEl) {
            overlayYardsEl = document.createElement('div');
            overlayYardsEl.style.position = 'absolute';
            overlayYardsEl.style.left = '10px';
            overlayYardsEl.style.bottom = '8px';
            overlayYardsEl.style.color = '#ffffff';
            overlayYardsEl.style.font = '600 16px system-ui, -apple-system, Segoe UI, Roboto, Arial';
            overlayYardsEl.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)';
            overlayYardsEl.style.pointerEvents = 'none';
            medalContainer.appendChild(overlayYardsEl);
        }
    }

    // Ensure gif.js library is loaded (in case CDN failed or loaded late)
    function ensureGifLibLoaded() {
        return new Promise((resolve, reject) => {
            if (typeof window.GIF !== 'undefined') {
                return resolve();
            }
            // Attempt to dynamically load from CDN
            const existing = document.querySelector('script[data-dynamic="gif.js"]');
            if (existing) {
                existing.addEventListener('load', () => (typeof window.GIF !== 'undefined') ? resolve() : reject(new Error('gif.js failed to load')));
                existing.addEventListener('error', () => reject(new Error('gif.js script failed to load')));
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.min.js';
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.setAttribute('data-dynamic', 'gif.js');
            script.addEventListener('load', () => {
                if (typeof window.GIF !== 'undefined') {
                    resolve();
                } else {
                    reject(new Error('gif.js loaded but GIF is undefined'));
                }
            });
            script.addEventListener('error', () => reject(new Error('gif.js script failed to load')));
            document.head.appendChild(script);
        });
    }

    // Create a same-origin Blob URL that bootstraps the real worker via importScripts.
    // This avoids cross-origin worker construction errors on hosts like GitHub Pages.
    function createGifWorkerBlobUrl() {
        const workerBootstrap = `self.window = self;\ntry {\n  importScripts('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.min.js');\n} catch (e) {\n  postMessage({ type: 'error', error: 'Failed to load gif.worker: ' + e.message });\n}`;
        const blob = new Blob([workerBootstrap], { type: 'application/javascript' });
        return URL.createObjectURL(blob);
    }

    // Interpolate along provided keyframes for a given progress 0..1 to get center (x,y)
    function getPositionForProgress(t) {
        const clamped = Math.max(0, Math.min(1, t));
        // Find segment
        let i = 0;
        for (; i < PATH_KEYFRAMES.length - 1; i++) {
            const a = PATH_KEYFRAMES[i];
            const b = PATH_KEYFRAMES[i + 1];
            if (clamped >= a.t && clamped <= b.t) {
                const span = (b.t - a.t) || 1;
                const local = (clamped - a.t) / span;
                const x = a.x + (b.x - a.x) * local;
                const y = a.y + (b.y - a.y) * local;
                return { x, y };
            }
        }
        // Fallback to last point
        const last = PATH_KEYFRAMES[PATH_KEYFRAMES.length - 1];
        return { x: last.x, y: last.y };
    }
    
    // Function to update the progress visualization
    function updateProgress(current, total) {
        ensureOverlays();
        const progress = Math.min(current / total, 1);
        const { x, y } = getPositionForProgress(progress);

        // Update swimmer position (convert center->top-left using provided offsets)
        swimmer.style.left = `${Math.round(x - SWIMMER_CENTER_OFFSET.x)}px`;
        swimmer.style.top = `${Math.round(y - SWIMMER_CENTER_OFFSET.y)}px`;

        // Update progress bar
        const progressPercent = Math.round(progress * 100);
        progressBar.style.width = `${progressPercent}%`;
        currentYardsSpan.textContent = Math.round(current);

        // Update overlays text
        overlayPctEl.textContent = `${progressPercent}%`;
        overlayYardsEl.textContent = `${Math.round(current)} / ${GOAL_YARDS} yards`;
        
        return { x, y };
    }
    
    // Function to generate the progress GIF using an offscreen canvas (no html2canvas)
    async function generateProgressGif() {
        let completedYards = parseInt(completedYardsInput.value) || 0;
        completedYards = Math.max(0, Math.min(GOAL_YARDS, completedYards));
        const totalFrames = 40; // Smoothness of animation

        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = 'Generating... <span class="loading"></span>';
        gifOutput.innerHTML = '';
        downloadLink.style.display = 'none';

        try {
            await waitForImages();
            // Make sure the GIF class is available even if the CDN script wasn't ready
            await ensureGifLibLoaded();
            // Choose a chroma key that does not appear in the images
            pickUnusedChromaKey();

            // Prepare offscreen canvas at fixed natural medal dimensions to avoid any aspect distortion
            const width = MEDAL_NATURAL_W;
            const height = MEDAL_NATURAL_H;
            const offscreen = document.createElement('canvas');
            offscreen.width = width;
            offscreen.height = height;
            const ctx = offscreen.getContext('2d');
            // Avoid sub-pixel smoothing differences frame-to-frame
            ctx.imageSmoothingEnabled = true;

            // Helper to draw a single frame at given yards
            function drawFrame(atYards) {
                // Use solid white matte to avoid magenta fringe and ensure consistent background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                // Draw medal at fixed natural size so background is identical each frame (over white)
                ctx.drawImage(medal, 0, 0, MEDAL_NATURAL_W, MEDAL_NATURAL_H);

                // Compute swimmer position via keyframe interpolation
                const progress = Math.min(atYards / GOAL_YARDS, 1);
                const pos = getPositionForProgress(progress);

                // Draw swimmer using provided center offset
                const drawX = Math.round(pos.x - SWIMMER_CENTER_OFFSET.x);
                const drawY = Math.round(pos.y - SWIMMER_CENTER_OFFSET.y);
                const targetW = Math.round(swimmer.naturalWidth || 94);
                const targetH = Math.round(swimmer.naturalHeight || 62);
                ctx.drawImage(swimmer, Math.round(drawX), Math.round(drawY), targetW, targetH);

                // Overlays: left yards and bottom-right percentage
                const pctText = `${Math.round(progress * 100)}%`;
                const yardsText = `${Math.round(atYards)} / ${GOAL_YARDS} yards`;
                ctx.save();
                ctx.font = '700 20px Segoe UI, system-ui, Arial';
                ctx.textBaseline = 'bottom';
                // No shadows to prevent color bleed in GIF palette
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                ctx.fillStyle = '#000000';
                // Left-bottom yards
                ctx.fillText(yardsText, 10, height - 8);
                // Right-bottom percentage
                const pctWidth = ctx.measureText(pctText).width;
                ctx.fillText(pctText, Math.round(width - 10 - pctWidth), height - 8);
                ctx.restore();
            }

            // Create a new GIF instance
            const workerBlobUrl = createGifWorkerBlobUrl();
            try {
                if (window.GIF && window.GIF.defaults) {
                    window.GIF.defaults.workerScript = workerBlobUrl;
                }
            } catch (_) {}
            const gif = new GIF({
                workers: 2,
                quality: 10,
                workerScript: workerBlobUrl,
                width,
                height,
                // Opaque white background to eliminate pink fringe
                background: '#ffffff',
                repeat: 0 // loop forever
            });
            try {
                console.debug('GIF workerScript in options:', gif.options && gif.options.workerScript);
            } catch (_) {}

            // Build frames
            for (let i = 0; i <= totalFrames; i++) {
                const progress = i / totalFrames;
                const atYards = Math.round(progress * completedYards);
                drawFrame(atYards);
                gif.addFrame(offscreen, { delay: i === totalFrames ? 3000 : 50, copy: true, dispose: 2 });

                const pct = Math.round((i / totalFrames) * 100);
                generateBtn.innerHTML = `Generating... ${pct}%`;
                await new Promise(r => setTimeout(r, 10));
            }

            gif.on('finished', function(blob) {
                const gifUrl = URL.createObjectURL(blob);
                const gifImg = document.createElement('img');
                gifImg.src = gifUrl;
                gifImg.alt = 'Swim Progress GIF';
                gifImg.style.maxWidth = '100%';
                gifImg.style.borderRadius = '8px';
                gifImg.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';

                gifOutput.innerHTML = '';
                gifOutput.appendChild(gifImg);

                downloadLink.href = gifUrl;
                downloadLink.download = `swim-progress-${completedYards}-of-${GOAL_YARDS}yds.gif`;
                downloadLink.style.display = 'inline-block';

                // Show share button
                shareGifBtn.style.display = 'inline-block';

                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Progress GIF';
                try { URL.revokeObjectURL(gif.options.workerScript); } catch (_) {}
            });

            // Render GIF
            gif.render();

        } catch (error) {
            console.error('Error generating GIF:', error);
            const note = (location.protocol === 'file:')
                ? '<br><small>Tip: Open via a local server (http://) or host the files (same origin) to avoid browser security limits for images drawn to canvas.</small>'
                : '';
            gifOutput.innerHTML = '<p style="color: red;">Could not generate GIF in this environment.' + note + '</p>';
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Progress GIF';
        }
    }

    // Initialize after images load so measurements are correct
    waitForImages().then(() => {
        const startYards = Math.max(0, Math.min(GOAL_YARDS, parseInt(completedYardsInput.value) || 0));
        updateProgress(startYards, GOAL_YARDS);
    });
});
