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
    
    // Path keyframes provided by user for swimmer center position (x,y) by progress t
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

    // Ensure images are loaded before we measure sizes/positions
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

            // Prepare offscreen canvas matching the visible container
            const width = medalContainer.offsetWidth;
            const height = medalContainer.offsetHeight;
            const offscreen = document.createElement('canvas');
            offscreen.width = width;
            offscreen.height = height;
            const ctx = offscreen.getContext('2d');

            // Helper to draw a single frame at given yards
            function drawFrame(atYards) {
                // Clear with transparent
                ctx.clearRect(0, 0, width, height);
                // Draw medal stretched to container (simple and robust)
                ctx.drawImage(medal, 0, 0, width, height);

                // Compute swimmer position via keyframe interpolation
                const progress = Math.min(atYards / GOAL_YARDS, 1);
                const pos = getPositionForProgress(progress);

                // Draw swimmer using provided center offset
                const drawX = Math.round(pos.x - SWIMMER_CENTER_OFFSET.x);
                const drawY = Math.round(pos.y - SWIMMER_CENTER_OFFSET.y);
                const targetW = swimmer.naturalWidth; // draw at natural size for fidelity
                const targetH = swimmer.naturalHeight;
                ctx.drawImage(swimmer, drawX, drawY, targetW, targetH);

                // Overlays: left yards and bottom-right percentage
                const pctText = `${Math.round(progress * 100)}%`;
                const yardsText = `${Math.round(atYards)} / ${GOAL_YARDS} yards`;
                ctx.save();
                ctx.font = '700 20px Segoe UI, system-ui, Arial';
                ctx.textBaseline = 'bottom';
                ctx.shadowColor = 'rgba(0,0,0,0.7)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetY = 1;
                ctx.fillStyle = '#ffffff';
                // Left-bottom yards
                ctx.fillText(yardsText, 10, height - 8);
                // Right-bottom percentage
                const pctWidth = ctx.measureText(pctText).width;
                ctx.fillText(pctText, width - 10 - pctWidth, height - 8);
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
                transparent: 0x00FF00 // not critical; helps some viewers
            });
            try {
                console.debug('GIF workerScript in options:', gif.options && gif.options.workerScript);
            } catch (_) {}

            // Build frames
            for (let i = 0; i <= totalFrames; i++) {
                const progress = i / totalFrames;
                const atYards = Math.round(progress * completedYards);
                drawFrame(atYards);
                gif.addFrame(offscreen, { delay: 50, copy: true });

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

                generateBtn.disabled = false;
                generateBtn.textContent = 'Generate Progress GIF';
                // Cleanup worker blob URL
                try { URL.revokeObjectURL(gif.options.workerScript); } catch (_) {}
            });

            // Render GIF
            try {
                gif.render();
            } catch (secErr) {
                throw secErr;
            }

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
