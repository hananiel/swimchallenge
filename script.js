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
    
    // Fixed, natural medal dimensions to ensure correct GIF aspect (provided)
    const MEDAL_NATURAL_W = 483;
    const MEDAL_NATURAL_H = 586;
    
    // Runtime-selected chroma key for GIF transparency handling
    let CHROMA_KEY = null; // { css: '#ff00ff', int: 0xff00ff }
    
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
    // Export video button click handler
    if (exportVideoBtn) exportVideoBtn.addEventListener('click', exportProgressVideo);
    // Share GIF button click handler
    if (shareGifBtn) shareGifBtn.addEventListener('click', shareGifToFacebook);
    // Share video button click handler
    if (shareVideoBtn) shareVideoBtn.addEventListener('click', shareVideoToFacebook);

    // Initialize Facebook SDK for sharing
    function initFacebookSDK() {
        return new Promise((resolve, reject) => {
            // Check if already initialized
            if (window.FB) {
                resolve();
                return;
            }

            // Load Facebook SDK
            const script = document.createElement('script');
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.onload = () => {
                window.fbAsyncInit = function() {
                    FB.init({
                        appId: null, // No app ID needed for basic sharing
                        version: 'v18.0'
                    });
                    resolve();
                };
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Share file using Web Share API or fallback to Facebook
    async function shareToFacebook(file, filename, customMessage = '') {
        const defaultMessage = `Check out my swim progress! 🏊‍♀️ I've completed ${filename.includes('of-') ? filename.split('of-')[0].split('-')[2] : 'some'} yards toward my goal!`;

        // Try Web Share API first (works on mobile and modern browsers)
        if (navigator.share && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    title: 'My Swim Progress',
                    text: customMessage || defaultMessage,
                    files: [file]
                });
                return true;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.log('Web Share API failed:', err);
                }
            }
        }

        // Fallback to Facebook Share Dialog
        try {
            await initFacebookSDK();

            // Create object URL for the file
            const fileUrl = URL.createObjectURL(file);

            // Use Facebook UI dialog for sharing
            FB.ui({
                method: 'share',
                href: fileUrl,
                quote: customMessage || defaultMessage,
            }, function(response) {
                // Clean up the object URL
                URL.revokeObjectURL(fileUrl);

                if (response && !response.error_code) {
                    console.log('Shared to Facebook successfully');
                } else {
                    console.log('Facebook sharing cancelled or failed');
                }
            });

            return true;
        } catch (error) {
            console.error('Facebook sharing failed:', error);
            return false;
        }
    }

    // Share GIF to Facebook
    async function shareGifToFacebook() {
        if (!downloadLink.href) return;

        try {
            // Fetch the blob from the object URL
            const response = await fetch(downloadLink.href);
            const blob = await response.blob();
            const file = new File([blob], downloadLink.download, { type: 'image/gif' });

            const yardsCompleted = completedYardsInput.value || '0';
            const customMessage = `Just tracked my swim progress - ${yardsCompleted} yards completed! 🏊‍♀️ Who's joining me in the pool?`;

            await shareToFacebook(file, downloadLink.download, customMessage);
        } catch (error) {
            console.error('Error sharing GIF:', error);
            alert('Failed to share GIF. You can still download it and share manually.');
        }
    }

    // Share video to Facebook
    async function shareVideoToFacebook() {
        if (!downloadVideo.href) return;

        try {
            // Fetch the blob from the object URL
            const response = await fetch(downloadVideo.href);
            const blob = await response.blob();
            const file = new File([blob], downloadVideo.download, { type: 'video/webm' });

            const yardsCompleted = completedYardsInput.value || '0';
            const customMessage = `Swim progress update! 🎉 Just completed ${yardsCompleted} yards - feeling accomplished! Who's up for a swim session?`;

            await shareToFacebook(file, downloadVideo.download, customMessage);
        } catch (error) {
            console.error('Error sharing video:', error);
            alert('Failed to share video. You can still download it and share manually.');
        }
    }
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
    
    // Function to export a WebM video using MediaRecorder with pause frames at the end
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

            // Record the canvas
            const stream = offscreen.captureStream(fps);
            const mimeCandidates = [
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm'
            ];
            let mimeType = '';
            for (const m of mimeCandidates) {
                if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
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

            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            const url = URL.createObjectURL(blob);

            // Preview video element
            const videoEl = document.createElement('video');
            videoEl.controls = true;
            videoEl.loop = true;
            videoEl.style.maxWidth = '100%';
            videoEl.src = url;
            gifOutput.innerHTML = '';
            gifOutput.appendChild(videoEl);

            // Download link
            downloadVideo.href = url;
            downloadVideo.download = `swim-progress-${completedYards}-of-${GOAL_YARDS}yds.webm`;
            downloadVideo.style.display = 'inline-block';

            // Show share button
            shareVideoBtn.style.display = 'inline-block';

        } catch (err) {
            console.error('Error exporting video:', err);
            gifOutput.innerHTML = '<p style="color: red;">Could not export video in this environment.</p>';
        } finally {
            exportVideoBtn.disabled = false;
            exportVideoBtn.textContent = originalBtnText || 'Export Video (WebM)';
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
