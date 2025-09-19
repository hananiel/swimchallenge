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
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.min.js';
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

    // Calculate a path radius based on rendered medal size
    function getPathRadius() {
        // Use a factor so the path sits nicely inside the medal edge
        const radiusFactor = 0.38; // tweak as needed for your artwork
        const w = medalContainer.clientWidth || 300;
        const h = medalContainer.clientHeight || 300;
        const radius = Math.min(w, h) * radiusFactor;
        return radius;
    }
    
    // Function to update the progress visualization
    function updateProgress(current, total) {
        const progress = Math.min(current / total, 1);
        const angle = progress * 360;
        const radius = getPathRadius(); // Radius of the medal path
        const centerX = medalContainer.offsetWidth / 2;
        const centerY = medalContainer.offsetHeight / 2;
        
        // Calculate position on the circular path
        const radian = (angle - 90) * (Math.PI / 180);
        const x = centerX + (radius * Math.cos(radian));
        const y = centerY + (radius * Math.sin(radian));
        
        // Update swimmer position
        swimmer.style.left = `${x}px`;
        swimmer.style.top = `${y}px`;
        
        // Update progress bar
        const progressPercent = Math.round(progress * 100);
        progressBar.style.width = `${progressPercent}%`;
        currentYardsSpan.textContent = Math.round(current);
        
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

                // Compute swimmer position
                const progress = Math.min(atYards / GOAL_YARDS, 1);
                const angle = progress * 360;
                const radius = getPathRadius();
                const centerX = width / 2;
                const centerY = height / 2;
                const radian = (angle - 90) * (Math.PI / 180);
                const x = centerX + (radius * Math.cos(radian));
                const y = centerY + (radius * Math.sin(radian));

                // Draw swimmer centered at (x,y) with width ~ CSS width (60px)
                const targetW = 60;
                const aspect = swimmer.naturalHeight / swimmer.naturalWidth;
                const targetH = Math.max(1, targetW * aspect);
                ctx.drawImage(swimmer, Math.round(x - targetW / 2), Math.round(y - targetH / 2), targetW, targetH);
            }

            // Create a new GIF instance
            const gif = new GIF({
                workers: 2,
                quality: 10,
                workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.min.js',
                width,
                height,
                transparent: 0x00FF00 // not critical; helps some viewers
            });

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
