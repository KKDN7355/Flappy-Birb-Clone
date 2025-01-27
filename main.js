const gameConfig = {
    // Okay to touch these.
    PIPE_FREQUENCY:                     1800,   // Controls spacing between pipes (in ms).
    FRAMES_PER_SECOND:                  15,     // Frames per second.
    FADE_STEP:                          0.05,   // Alpha decrement per fade interval.
    FADE_INTERVAL:                      50,     // Interval for tutorial fade effect (in ms).
};

class FlappyBird {
    constructor(config) {
        // Flags
        this.resourcesLoaded = false;

        // Store the configuration.
        this.config = config;

        // First play through.
        this.state = 'GAME_OPEN'

        // Initialise game.
        this.initConstants();
        this.initUI();
        this.initResources().then(() => {
            this.initGameObjects();
            this.startGameLoop();
            this.resourcesLoaded = true;
        });
    }

    // Inits
    initConstants() {
        // Initialise dependent properties.
        const aspectRatio               = 9 / 16;

        this.BOARD_HEIGHT               = window.innerHeight;
        this.BOARD_WIDTH                = this.BOARD_HEIGHT * aspectRatio;

        this.XX                         = -this.BOARD_WIDTH  /150;
        this.Y                          = -this.BOARD_HEIGHT /64;
        this.YY                         = 0;
        this.YYY                        = this.BOARD_HEIGHT  /1280;

        // Precompute static bird properties.
        this.BIRD_WIDTH                 = this.BOARD_WIDTH   * 0.1000;
        this.BIRD_HEIGHT                = this.BOARD_HEIGHT  * 0.0375;
        this.BIRD_START_X               = this.BOARD_WIDTH   * 0.1250;
        this.BIRD_START_Y               = this.BOARD_HEIGHT  * 0.5000;

        // Precompute static game tutorial properties.
        this.GAMETUTE_WIDTH             = this.BOARD_WIDTH   * 0.50;
        this.GAMETUTE_HEIGHT            = this.BOARD_HEIGHT  * 0.25;
        this.GAMETUTE_X                 = (this.BOARD_WIDTH  - this.GAMETUTE_WIDTH)  / 2;
        this.GAMETUTE_Y                 = (this.BOARD_HEIGHT - this.GAMETUTE_HEIGHT) / 2;

        // Precompute static game over properties.
        this.GAMEOVER_WIDTH             = this.BOARD_WIDTH   * 0.50;
        this.GAMEOVER_HEIGHT            = this.BOARD_HEIGHT  * 0.25;
        this.GAMEOVER_X                 = (this.BOARD_WIDTH  - this.GAMEOVER_WIDTH)  / 2;
        this.GAMEOVER_Y                 = (this.BOARD_HEIGHT - this.GAMEOVER_HEIGHT) / 2;

        // Precompute static score properties.
        this.SCORECURR_Y                = this.BOARD_HEIGHT / 8;
        this.SCORELAST_Y                = this.GAMEOVER_Y   + this.BIRD_HEIGHT * 3.5;
        this.SCOREBEST_Y                = this.GAMEOVER_Y   + this.BIRD_HEIGHT * 5.0;
        this.SCORE_FONTSIZE             = this.BOARD_WIDTH  / 12;

        // Precompute static pipe properties.
        this.PIPE_WIDTH                 = this.BOARD_WIDTH  * 0.12500;
        this.PIPE_HEIGHT                = this.BOARD_HEIGHT * 0.78125;
        this.PIPE_MIN_Y                 = this.BOARD_HEIGHT * -0.7500;
        this.PIPE_MAX_Y                 = this.BOARD_HEIGHT * -0.0625;
        this.PIPE_OPENING               = this.BOARD_HEIGHT / 4;

        // Precompute static gravity inverter properties.
        this.GRAVITYINVERTER_WIDTH      = this.PIPE_WIDTH * 0.8;
        this.GRAVITYINVERTER_HEIGHT     = this.PIPE_WIDTH * 0.8;

        // Initialise other properties.
        this.canvas                     = null;
        this.ctx                        = null;
        this.gameTuteOpacity            = 0.0;
        this.gameOverOpacity            = 0.0;
        
        // Initialise game state variables.
        this.gravity                    = this.YYY;
        this.velocity                   = this.YY;
        this.displacement               = this.Y;
        this.pipes                      = [];
        this.pipeCounter                = 0;
        this.score                      = 0;
        this.bestScore                  = 0;
        this.gravityInverted            = false;
    }

    initUI() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.BOARD_WIDTH;
        this.canvas.height = this.BOARD_HEIGHT;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        window.addEventListener('keydown', (e) => this.keyPressed(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTap(e), { passive: false });
        this.canvas.addEventListener('click', (e) => this.handleTap(e));
    }

    async initResources() {
        const imagePaths = {
            birdA:                      'assets/images/bird_a.png',
            birdB:                      'assets/images/bird_b.png',
            birdC:                      'assets/images/bird_c.png',
            gameBackground:             'assets/images/game_background.png',
            gameOver:                   'assets/images/game_over.png',
            gameTute:                   'assets/images/game_tute.png',
            gravityInverter:            'assets/images/gravity_inverter.png',
            pipeBot:                    'assets/images/pipe_bot.png',
            pipeTop:                    'assets/images/pipe_top.png',
        };

        const soundPaths = {
            bgNormal:                   'assets/audio/bg_normal.wav',
            bgInverted:                 'assets/audio/bg_inverted.wav',
            die:                        'assets/audio/die.wav',
            hit:                        'assets/audio/hit.wav',
            point:                      'assets/audio/point.wav',
            swoosh:                     'assets/audio/swoosh.wav',
            wing:                       'assets/audio/wing.wav',
            victory:                    'assets/audio/victory.wav',
        };

        const loadImage = (src) =>
            new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = reject;
            });

        const loadSound = (src) =>
            new Promise((resolve) => {
                const audio = new Audio(src);
                resolve(audio);
            });

        this.images = {};
        for (const [key, path] of Object.entries(imagePaths)) {
            this.images[key] = await loadImage(path);
        }

        this.sounds = {};
        for (const [key, path] of Object.entries(soundPaths)) {
            this.sounds[key] = await loadSound(path);
        }
    }

    initGameObjects() {
        this.bird = new Bird(
            this.BIRD_START_X,
            this.BIRD_START_Y,
            this.BIRD_WIDTH,
            this.BIRD_HEIGHT,
            this.images.birdA,
            this.images.birdB,
            this.images.birdC
        );
    }

    initGameTimers() {
        this.pipeTimer = setInterval(() => this.spawnPipes(), this.config.PIPE_FREQUENCY);

        this.gameTimer = setInterval(() => {
            this.moveGameObjects();
        }, 1000 / this.config.FRAMES_PER_SECOND);

        this.birdTimer = setInterval(() => {
            this.bird.nextFrame();
        }, 100);
    }

    stopTimers() {
        if (this.pipeTimer) clearInterval(this.pipeTimer);
        if (this.gameTimer) clearInterval(this.gameTimer);
        if (this.birdTimer) clearInterval(this.birdTimer);
    }

    // Game Logic
    spawnPipes() {
        const pipeRanY = this.PIPE_MIN_Y + Math.floor(Math.random() * (this.PIPE_MAX_Y - this.PIPE_MIN_Y));

        this.pipes.push(new Pipe(this.BOARD_WIDTH, pipeRanY,                                        this.PIPE_WIDTH, this.PIPE_HEIGHT, this.images.pipeTop));
        this.pipes.push(new Pipe(this.BOARD_WIDTH, pipeRanY + this.PIPE_HEIGHT + this.PIPE_OPENING, this.PIPE_WIDTH, this.PIPE_HEIGHT, this.images.pipeBot));

        if (this.pipeCounter % 10 === 9) {
            const gravityInverterY = pipeRanY + this.PIPE_HEIGHT + (this.PIPE_OPENING / 2) - this.GRAVITYINVERTER_HEIGHT / 2;

            this.pipes.push(new GravityInverter(this.BOARD_WIDTH, gravityInverterY, this.GRAVITYINVERTER_WIDTH, this.GRAVITYINVERTER_HEIGHT, this.images.gravityInverter));
        }

        this.pipeCounter++;
    }

    handlePipeCollision(pipe) {
        if (!pipe.isPassed() && this.bird.passed(pipe)) {
            pipe.markPassed();
            this.sounds.point.play();
            this.score += 0.5;
        }
        if (this.bird.collidesWith(pipe)) {
            this.handleGameOver();
        }
    }

    handleGravityInverterCollision(inverter) {
        if (!inverter.isPassed() && this.bird.collidesWith(inverter)) {
            inverter.markPassed();
            this.sounds.swoosh.play();

            this.gravityInverted = !this.gravityInverted;
            this.displacement = this.gravityInverted ? -this.Y : this.Y;
            this.gravity = this.gravityInverted ? -this.YYY : this.YYY;

            if (this.gravityInverted) {
                this.sounds.bgNormal.pause();
                this.sounds.bgInverted.play();
            } else {
                this.sounds.bgInverted.pause();
                this.sounds.bgNormal.play();
            }
        }
    }

    moveGameObjects() {
        if (this.bird.isOutOfBounds(this.BOARD_HEIGHT)) {
            this.handleGameOver();
            return;
        }

        this.velocity += this.gravity;
        this.bird.move(this.velocity);

        this.pipes.forEach(obj => {
            obj.move(this.XX);

            if (obj instanceof Pipe) {
                this.handlePipeCollision(obj);
            } else if (obj instanceof GravityInverter) {
                this.handleGravityInverterCollision(obj);
            }
        });

        this.pipes = this.pipes.filter(obj => !obj.isOutOfBounds());
    }

    startGameLoop() {
        const loop = () => {
            if (!this.resourcesLoaded) return;
    
            if (this.state === 'GAME_OPEN') {
                if (this.gameTuteOpacity < 1.0) {
                    this.startFadeLoop('gameTuteOpacity', this.config.FADE_STEP, this.config.FADE_INTERVAL, true);
                } else {
                    this.startFadeLoop('gameTuteOpacity', this.config.FADE_STEP, this.config.FADE_INTERVAL, false);
                }
                this.drawGame();
            } else if (this.state === 'GAME_PLAY') {
                this.moveGameObjects();
                this.drawGame();
            } else if (this.state === 'GAME_OVER') {
                this.drawGame();
            }
    
            requestAnimationFrame(loop);
        };
    
        requestAnimationFrame(loop);
    }

    startGame() {
        this.state = "GAME_PLAY";
        this.gameTuteOpacity = 1.0;
    
        this.fadeOut("gameTuteOpacity", this.config.FADE_STEP, this.config.FADE_INTERVAL);
    
        this.initGameTimers();

        this.sounds.bgNormal.play();
        this.sounds.bgInverted.pause();
        this.sounds.bgInverted.currentTime = 0;
    }

    resetGame() {
        this.state = "GAME_PLAY";
    
        this.stopTimers();
        this.stopGameOverFadeLoop();

        this.gameTuteOpacity = 1.0;
        this.gameOverOpacity = 0.0;

        this.gravity        = this.YYY;
        this.velocity       = this.YY;
        this.displacement   = this.Y;
        this.pipes          = [];
        this.pipeCounter    = 0;
        this.score          = 0;

        this.gravityInverted            = false;

        this.bird.reset(this.BIRD_START_X, this.BIRD_START_Y);
    
        this.fadeOut("gameTuteOpacity", this.config.FADE_STEP, this.config.FADE_INTERVAL);
    
        this.initGameTimers();

        this.sounds.bgNormal.play();
        this.sounds.bgInverted.pause();
        this.sounds.bgInverted.currentTime = 0;
    }

    handleGameOver() {
        this.state = 'GAME_OVER';
        this.sounds.die.play();
        this.stopTimers();

        if (this.score > this.bestScore) {
            this.bestScore = this.score;
        }

        this.gameOverOpacity = 0.0;
        this.startGameOverFadeLoop();
    }

    // Event Handlers
    keyPressed(e) {
        if (e.code === 'Space') {
            if (this.state === 'GAME_OPEN') {
                this.startGame();
            } else if (this.state === 'GAME_OVER') {
                this.resetGame();
            } else {
                this.handleBirdFlap();
            }
        }
    }

    handleTap(e) {
        e.preventDefault();
        if (this.state === 'GAME_OPEN') {
            this.startGame();
        } else if (this.state === 'GAME_OVER') {
            this.resetGame();
        } else {
            this.handleBirdFlap();
        }
    }

    handleBirdFlap() {
        this.sounds.wing.play();
        this.velocity = this.displacement;
    }

    // Rendering
    drawGame() {
        this.ctx.drawImage(this.images.gameBackground, 0, 0, this.BOARD_WIDTH, this.BOARD_HEIGHT);
    
        if (this.state === 'GAME_OPEN') {
            this.ctx.globalAlpha = this.gameTuteOpacity;
            this.ctx.drawImage(
                this.images.gameTute,
                this.GAMETUTE_X,
                this.GAMETUTE_Y,
                this.GAMETUTE_WIDTH,
                this.GAMETUTE_HEIGHT
            );
            this.ctx.globalAlpha = 1.0;
        } else if (this.state === 'GAME_PLAY') {
            this.bird.draw(this.ctx);
            this.pipes.forEach((pipe) => pipe.draw(this.ctx));
    
            if (this.gameTuteOpacity > 0) {
                this.ctx.globalAlpha = this.gameTuteOpacity;
                this.ctx.drawImage(
                    this.images.gameTute,
                    this.GAMETUTE_X,
                    this.GAMETUTE_Y,
                    this.GAMETUTE_WIDTH,
                    this.GAMETUTE_HEIGHT
                );
                this.ctx.globalAlpha = 1.0;
            } else {
                this.drawTextAlignedCenter(
                    `Score: ${Math.floor(this.score)}`,
                    this.SCORECURR_Y,
                    this.SCORE_FONTSIZE
                );
            }
        } else if (this.state === 'GAME_OVER') {
            this.ctx.globalAlpha = this.gameOverOpacity;
            this.ctx.drawImage(
                this.images.gameOver,
                this.GAMEOVER_X,
                this.GAMEOVER_Y,
                this.GAMEOVER_WIDTH,
                this.GAMEOVER_HEIGHT
            );
            this.ctx.globalAlpha = 1.0;
    
            this.drawTextAlignedRight(`Last Score: ${Math.floor(this.score)}`, this.SCORELAST_Y, this.SCORE_FONTSIZE);
            this.drawTextAlignedRight(`Best Score: ${Math.floor(this.bestScore)}`, this.SCOREBEST_Y, this.SCORE_FONTSIZE);
        }
    }

    drawTextAlignedRight(text, y, fontSize) {
        this.ctx.font = `${fontSize}px 'FlappyFont'`;
        this.ctx.fillStyle = 'white';
        const metrics = this.ctx.measureText(text);
        const x = this.BOARD_WIDTH - metrics.width - (this.BOARD_WIDTH / 5);
        this.ctx.fillText(text, x, y);
    }

    drawTextAlignedCenter(text, y, fontSize) {
        this.ctx.font = `${fontSize}px 'FlappyFont'`;
        this.ctx.fillStyle = 'white';
        const metrics = this.ctx.measureText(text);
        const x = (this.BOARD_WIDTH - metrics.width) / 2;
        this.ctx.fillText(text, x, y);
    }

    // Fade Functions
    startGameOverFadeLoop(step = this.config.FADE_STEP, interval = this.config.FADE_INTERVAL) {
        if (this.gameOverFadeInterval) {
            return;
        }
    
        let fadeIn = true;
    
        this.gameOverFadeInterval = setInterval(() => {
            if (fadeIn) {
                this.gameOverOpacity = Math.min(1.0, this.gameOverOpacity + step);
                if (this.gameOverOpacity >= 1.0) {
                    fadeIn = false;
                }
            } else {
                this.gameOverOpacity = Math.max(0.0, this.gameOverOpacity - step);
                if (this.gameOverOpacity <= 0.0) {
                    fadeIn = true;
                }
            }
        }, interval);
    }

    stopGameOverFadeLoop() {
        if (this.gameOverFadeInterval) {
            clearInterval(this.gameOverFadeInterval);
            this.gameOverFadeInterval = null;
        }
    }

    startFadeLoop(targetOpacityKey, step, interval, fadeIn = true, onComplete = null) {
        if (this[`fadeInterval_${targetOpacityKey}`]) {
            return;
        }

        this[`fadeInterval_${targetOpacityKey}`] = setInterval(() => {
            if (fadeIn) {
                this[targetOpacityKey] = Math.min(1.0, this[targetOpacityKey] + step);
                if (this[targetOpacityKey] >= 1.0) {
                    clearInterval(this[`fadeInterval_${targetOpacityKey}`]);
                    this[`fadeInterval_${targetOpacityKey}`] = null;
                    if (onComplete) onComplete();
                }
            } else {
                this[targetOpacityKey] = Math.max(0.0, this[targetOpacityKey] - step);
                if (this[targetOpacityKey] <= 0.0) {
                    clearInterval(this[`fadeInterval_${targetOpacityKey}`]);
                    this[`fadeInterval_${targetOpacityKey}`] = null;
                    if (onComplete) onComplete();
                }
            }
        }, interval);
    }
    
    stopFadeLoop(targetOpacityKey, finalOpacity) {
        if (this[`fadeInterval_${targetOpacityKey}`]) {
            clearInterval(this[`fadeInterval_${targetOpacityKey}`]);
            this[`fadeInterval_${targetOpacityKey}`] = null;
        }
        this[targetOpacityKey] = finalOpacity;
    }

    fadeIn(targetOpacityKey, step, interval, onComplete = () => {}) {
        if (this.currentFadeInterval) clearInterval(this.currentFadeInterval);
    
        this.currentFadeInterval = setInterval(() => {
            this[targetOpacityKey] = Math.min(1.0, this[targetOpacityKey] + step);
            if (this[targetOpacityKey] >= 1.0) {
                clearInterval(this.currentFadeInterval);
                this.currentFadeInterval = null;
                onComplete();
            }
        }, interval);
    }
    
    fadeOut(targetOpacityKey, step, interval, onComplete = () => {}) {
        if (this.currentFadeInterval) clearInterval(this.currentFadeInterval);
    
        this.currentFadeInterval = setInterval(() => {
            this[targetOpacityKey] = Math.max(0.0, this[targetOpacityKey] - step);
    
            if (this[targetOpacityKey] <= 0.0) {
                clearInterval(this.currentFadeInterval);
                this.currentFadeInterval = null;
                onComplete();
            }
        }, interval);
    }
}

class Bird {
    constructor(x, y, width, height, ...frames) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.animationFrames = frames;
        this.currentFrame = 0;
    }

    move(velocity) {
        this.y += velocity;
    }

    draw(ctx) {
        ctx.drawImage(this.animationFrames[this.currentFrame], this.x, this.y, this.width, this.height);
    }

    nextFrame() {
        this.currentFrame = (this.currentFrame + 1) % this.animationFrames.length;
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.currentFrame = 0;
    }

    isOutOfBounds(boardHeight) {
        return this.y > boardHeight || this.y < 0;
    }

    collidesWith(obj) {
        return this.x < obj.getX() + obj.getWidth() &&
               this.x + this.width > obj.getX() &&
               this.y < obj.getY() + obj.getHeight() &&
               this.y + this.height > obj.getY();
    }

    passed(pipe) {
        return this.x > pipe.getX();
    }
}

class GameObject {
    constructor(x, y, width, height, img) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.img = img;
    }

    move(velocityX) {
        this.x += velocityX;
    }

    draw(ctx) {
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }

    isOutOfBounds() {
        return this.x + this.width < 0;
    }

    getX() {
        return this.x;
    }

    getY() {
        return this.y;
    }

    getWidth() {
        return this.width;
    }

    getHeight() {
        return this.height;
    }
}

class Pipe extends GameObject {
    constructor(x, y, width, height, img) {
        super(x, y, width, height, img);
        this.passed = false;
    }

    isPassed() {
        return this.passed;
    }

    markPassed() {
        this.passed = true;
    }
}

class GravityInverter extends GameObject {
    constructor(x, y, width, height, img) {
        super(x, y, width, height, img);
        this.passed = false;
    }

    isPassed() {
        return this.passed;
    }

    markPassed() {
        this.passed = true;
    }
}

window.onload = () => {
    const game = new FlappyBird(gameConfig);
};