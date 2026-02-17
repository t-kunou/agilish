// アジャイル百人一首 - ゲームロジック

class AgilishGame {
    constructor() {
        // 画面要素
        this.startScreen = document.getElementById('start-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.resultScreen = document.getElementById('result-screen');
        this.effectOverlay = document.getElementById('effect-overlay');

        // ゲーム情報表示要素
        this.scoreElement = document.getElementById('score');
        this.remainingElement = document.getElementById('remaining');
        this.timerElement = document.getElementById('timer');
        this.timerContainer = document.getElementById('timer-container');
        this.readingText = document.getElementById('reading-text');
        this.cardsArea = document.getElementById('cards-area');
        this.livesArea = document.getElementById('lives-area');

        // 結果画面要素
        this.finalScoreElement = document.getElementById('final-score');
        this.accuracyElement = document.getElementById('accuracy');
        this.totalTimeElement = document.getElementById('total-time');
        this.resultMessage = document.getElementById('result-message');

        // カウントダウン要素
        this.countdownOverlay = document.getElementById('countdown-overlay');
        this.countdownNumber = document.getElementById('countdown-number');

        // ボタン
        this.startBtn = document.getElementById('start-btn');
        this.replayBtn = document.getElementById('replay-btn');
        this.retryBtn = document.getElementById('retry-btn');

        // オプション
        this.showTextOption = document.getElementById('show-text-option');

        // 難易度設定
        this.difficultySettings = {
            easy: { cardCount: 10, timeLimit: null, speechRate: 0.8, missLimit: null },
            normal: { cardCount: 20, timeLimit: 30, missLimit: 10 },
            hard: { cardCount: 30, timeLimit: 15, speechRate: 1.2, missLimit: 5 },
            inferno: { cardCount: 40, timeLimit: 12, speechRate: 2.0, missLimit: 3 },
            nightmare: { cardCount: Infinity, timeLimit: 10, speechRate: 3.0, missLimit: 1 }
        };

        // ゲーム状態
        this.practices = [];
        this.selectedPractices = [];
        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.currentTimeLeft = null;
        this.difficulty = 'easy';
        this.showText = true;
        this.isProcessing = false;

        // 音声合成
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.voicesReady = false;

        // 効果音用AudioContext
        this.audioContext = null;

        this.init();
    }

    // AudioContextを初期化（ユーザー操作後に呼び出す）
    initAudioContext() {
        try {
            if (!this.audioContext) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    this.audioContext = new AudioContextClass();
                    console.log('AudioContext initialized:', this.audioContext.state);
                }
            }
            // サスペンド状態なら再開
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    console.log('AudioContext resumed:', this.audioContext.state);
                });
            }
        } catch (e) {
            console.error('AudioContext初期化エラー:', e);
        }
    }

    // 効果音: 畳を叩く音
    playTatamiSound() {
        console.log('playTatamiSound called');

        try {
            if (!this.audioContext) {
                console.log('AudioContext not found, initializing...');
                this.initAudioContext();
            }

            if (!this.audioContext) {
                console.error('AudioContext is still null');
                return;
            }

            // サスペンド状態なら再開を待つ
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            console.log('AudioContext state:', this.audioContext.state);

            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // シンプルな「パン！」音
            // 1. インパクト音
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
            gain.gain.setValueAtTime(1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);

            // 2. ノイズ（パチッという音）
            const bufferSize = ctx.sampleRate * 0.15;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noise.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(now);

            console.log('Sound played at:', now);
        } catch (e) {
            console.error('効果音の再生に失敗:', e);
        }
    }

    async init() {
        // スタートボタンを無効化（準備中）
        this.startBtn.disabled = true;
        this.startBtn.textContent = '読み込み中...';

        await Promise.all([
            this.loadPractices(),
            this.loadVoices()
        ]);

        this.bindEvents();

        // 準備完了
        this.startBtn.disabled = false;
        this.startBtn.textContent = 'はじめる';
    }

    async loadVoices() {
        return new Promise((resolve) => {
            // 音声リストがすでに利用可能な場合
            const voices = this.synth.getVoices();
            if (voices.length > 0) {
                this.voicesReady = true;
                resolve();
                return;
            }

            // 音声リストの読み込みを待つ
            const handleVoicesChanged = () => {
                const voices = this.synth.getVoices();
                if (voices.length > 0) {
                    this.voicesReady = true;
                    this.synth.onvoiceschanged = null;
                    resolve();
                }
            };

            this.synth.onvoiceschanged = handleVoicesChanged;

            // タイムアウト（5秒後に強制的に解決）
            setTimeout(() => {
                if (!this.voicesReady) {
                    console.warn('音声リストの読み込みがタイムアウトしました。音声なしで続行します。');
                    this.synth.onvoiceschanged = null;
                    resolve();
                }
            }, 5000);
        });
    }

    async loadPractices() {
        try {
            const response = await fetch('practices.json');
            const data = await response.json();
            this.practices = data.practices;
        } catch (error) {
            console.error('プラクティスデータの読み込みに失敗しました:', error);
            alert('practices.json の読み込みに失敗しました。ファイルが存在するか確認してください。');
        }
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.replayBtn.addEventListener('click', () => this.speakCurrentPractice());
        this.retryBtn.addEventListener('click', () => this.showStartScreen());
    }

    showStartScreen() {
        this.startScreen.classList.remove('hidden');
        this.gameScreen.classList.add('hidden');
        this.resultScreen.classList.add('hidden');
        this.stopSpeaking();
        this.clearTimer();
    }

    startGame() {
        // 効果音用AudioContextを初期化（ユーザー操作のタイミングで）
        this.initAudioContext();

        // 難易度取得
        const difficultyInput = document.querySelector('input[name="difficulty"]:checked');
        this.difficulty = difficultyInput ? difficultyInput.value : 'easy';
        this.showText = this.showTextOption.checked;

        const settings = this.difficultySettings[this.difficulty];
        const cardCount = Math.min(settings.cardCount, this.practices.length);

        // プラクティスをシャッフルして選択
        this.selectedPractices = this.shuffleArray([...this.practices]).slice(0, cardCount);

        // ゲーム状態初期化
        this.currentIndex = 0;
        this.score = 0;
        this.correctCount = 0;
        this.wrongCount = 0;
        this.isProcessing = false;
        this.isGameOver = false;
        this.missedPractices = [];

        // 画面切り替え
        this.startScreen.classList.add('hidden');
        this.gameScreen.classList.remove('hidden');
        this.resultScreen.classList.add('hidden');

        // タイマー表示制御
        if (settings.timeLimit === null) {
            this.timerContainer.classList.add('hidden');
        } else {
            this.timerContainer.classList.remove('hidden');
        }

        // UI更新
        this.updateScore();
        this.updateRemaining();
        this.renderLives();

        // カードエリアの高さを調整
        this.adjustCardsAreaHeight(this.selectedPractices.length);

        // カード生成（DOMが更新されてからサイズを取得するため少し待つ）
        requestAnimationFrame(() => {
            this.generateCards();
        });

        // カウントダウン開始
        this.showCountdown();
    }

    showCountdown() {
        this.countdownOverlay.classList.remove('hidden');
        let count = 3;

        // AudioContextのresume完了を待ってからカウントダウン開始
        const start = () => {
            if (count > 0) {
                this.playCountdownBeep(false);
                this.countdownNumber.textContent = count;
                this.countdownNumber.classList.remove('start-text');
                // アニメーションをリセット
                this.countdownNumber.style.animation = 'none';
                this.countdownNumber.offsetHeight; // リフロー強制
                this.countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
                count--;
                setTimeout(start, 1000);
            } else {
                // 「スタート！」表示
                this.playCountdownBeep(true);
                this.countdownNumber.textContent = 'スタート！';
                this.countdownNumber.classList.add('start-text');
                this.countdownNumber.style.animation = 'none';
                this.countdownNumber.offsetHeight;
                this.countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

                setTimeout(() => {
                    this.countdownOverlay.classList.add('hidden');
                    // ゲーム開始時刻を記録
                    this.startTime = Date.now();
                    // 最初の問題開始
                    this.nextQuestion();
                }, 800);
            }
        };

        const ctx = this.audioContext;
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().then(() => start());
        } else {
            start();
        }
    }

    playCountdownBeep(isStart) {
        if (!this.audioContext) {
            this.initAudioContext();
        }
        if (!this.audioContext) return;

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isStart ? 880 : 440, now);
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isStart ? 0.5 : 0.3));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + (isStart ? 0.5 : 0.3));
    }

    generateCards() {
        this.cardsArea.innerHTML = '';

        // カード用にシャッフルした配列を作成
        const shuffledForDisplay = this.shuffleArray([...this.selectedPractices]);
        const totalCards = shuffledForDisplay.length;

        // カードエリアのサイズを取得
        const areaRect = this.cardsArea.getBoundingClientRect();
        const areaWidth = areaRect.width - 40; // パディング分を引く
        const areaHeight = areaRect.height - 40;

        // カードサイズ（CSSと合わせる）
        const cardWidth = window.innerWidth <= 480 ? 70 : (window.innerWidth <= 768 ? 85 : 100);
        const cardHeight = window.innerWidth <= 480 ? 100 : (window.innerWidth <= 768 ? 120 : 140);

        // 3段に分けて配置
        const rows = 4;
        const cardsPerRow = Math.ceil(totalCards / rows);
        const rowHeight = (areaHeight - cardHeight) / (rows - 1 || 1);

        // 配置済み位置を記録（重なり防止用）
        const placedPositions = [];

        shuffledForDisplay.forEach((practice, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.name = practice.name;

            // カテゴリを角丸四角で表示
            const categories = practice.category || [];
            if (categories.length > 0) {
                const catContainer = document.createElement('div');
                catContainer.className = 'card-categories';

                categories.forEach(cat => {
                    const catEl = document.createElement('span');
                    catEl.className = 'card-category ' + this.getCategoryClass(cat);
                    catEl.textContent = this.getCategoryShortName(cat);
                    catContainer.appendChild(catEl);
                });

                card.appendChild(catContainer);
            }

            // カード名
            const name = document.createElement('span');
            name.className = 'card-name';
            name.textContent = practice.name;
            if (practice.alias) {
                const alias = document.createElement('span');
                alias.className = 'card-alias';
                alias.textContent = `(${practice.alias})`;
                name.appendChild(alias);
            }
            card.appendChild(name);

            // 行を決定
            const row = Math.floor(index / cardsPerRow);
            const colIndex = index % cardsPerRow;
            const cardsInThisRow = Math.min(cardsPerRow, totalCards - row * cardsPerRow);

            // 基本位置を計算
            const colWidth = (areaWidth - cardWidth) / (cardsInThisRow - 1 || 1);
            let baseX = colIndex * colWidth;
            let baseY = row * rowHeight;

            // ランダムなオフセットを追加（±30px）
            const randomOffsetX = (Math.random() - 0.5) * 60;
            const randomOffsetY = (Math.random() - 0.5) * 40;

            let x = Math.max(0, Math.min(areaWidth - cardWidth, baseX + randomOffsetX));
            let y = Math.max(0, Math.min(areaHeight - cardHeight, baseY + randomOffsetY));

            // ランダムな回転（±8度）
            const rotation = (Math.random() - 0.5) * 16;

            // 位置とスタイルを設定
            card.style.left = `${x + 20}px`;
            card.style.top = `${y + 20}px`;
            card.style.transform = `rotate(${rotation}deg)`;
            card.style.zIndex = index + 1;

            card.addEventListener('click', () => this.selectCard(card, practice.name));
            this.cardsArea.appendChild(card);
        });
    }

    adjustCardsAreaHeight(cardCount) {
        // カードサイズ（CSSと合わせる）
        const cardHeight = window.innerWidth <= 480 ? 100 : (window.innerWidth <= 768 ? 120 : 140);

        // 3段で配置するための高さを計算
        const rows = 4;
        const padding = 40;
        const rowGap = 30;
        const minHeight = (cardHeight * rows) + (rowGap * (rows - 1)) + padding;

        this.cardsArea.style.minHeight = `${minHeight}px`;
    }

    nextQuestion() {
        if (this.isGameOver) return;
        if (this.currentIndex >= this.selectedPractices.length) {
            this.endGame();
            return;
        }

        this.isProcessing = false;
        const currentPractice = this.selectedPractices[this.currentIndex];

        // テキスト表示
        if (this.showText) {
            this.readingText.textContent = currentPractice.description;
            this.readingText.classList.remove('hidden-text');
        } else {
            this.readingText.textContent = currentPractice.description;
            this.readingText.classList.add('hidden-text');
        }

        // タイマー開始
        this.startTimer();

        // 音声読み上げ
        this.speakCurrentPractice();
    }

    speakCurrentPractice() {
        this.stopSpeaking();

        const currentPractice = this.selectedPractices[this.currentIndex];
        if (!currentPractice) return;

        // 読み上げ用テキストがあればそちらを使用、なければdescriptionを使用
        const textToSpeak = currentPractice.reading || currentPractice.description;
        this.currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
        this.currentUtterance.lang = 'ja-JP';
        const settings = this.difficultySettings[this.difficulty];
        this.currentUtterance.rate = settings.speechRate || 1.0;
        this.currentUtterance.pitch = 1.0;

        // 日本語の音声を選択（優先順位: ja-JP > ja > その他）
        const voices = this.synth.getVoices();
        let japaneseVoice = voices.find(voice => voice.lang === 'ja-JP');
        if (!japaneseVoice) {
            japaneseVoice = voices.find(voice => voice.lang.startsWith('ja'));
        }
        if (japaneseVoice) {
            this.currentUtterance.voice = japaneseVoice;
        }

        // Chrome対策: 長いテキストが途中で止まる問題を回避
        this.currentUtterance.onend = () => {
            this.currentUtterance = null;
        };
        this.currentUtterance.onerror = (event) => {
            console.warn('音声読み上げエラー:', event.error);
        };

        this.synth.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
    }

    selectCard(cardElement, selectedName) {
        if (this.isProcessing) return;
        if (cardElement.classList.contains('disabled')) return;

        this.isProcessing = true;
        const currentPractice = this.selectedPractices[this.currentIndex];
        const isCorrect = selectedName === currentPractice.name;

        if (isCorrect) {
            this.handleCorrect(cardElement);
        } else {
            this.handleWrong(cardElement);
        }
    }

    handleCorrect(cardElement) {
        this.correctCount++;
        this.clearTimer();
        this.stopSpeaking();

        // 効果音（畳を叩く音）
        this.playTatamiSound();

        // スコア計算（残り時間ボーナス）
        const settings = this.difficultySettings[this.difficulty];
        let bonus = 100;
        if (settings.timeLimit && this.currentTimeLeft) {
            bonus += Math.floor(this.currentTimeLeft * 10);
        }
        this.score += bonus;

        // エフェクト
        this.showEffect('correct');
        cardElement.classList.add('correct');

        // カードを無効化
        setTimeout(() => {
            cardElement.classList.add('disabled');
            cardElement.style.visibility = 'hidden';
        }, 500);

        // 次の問題へ
        setTimeout(() => {
            this.currentIndex++;
            this.updateScore();
            this.updateRemaining();
            this.nextQuestion();
        }, 800);
    }

    handleWrong(cardElement) {
        // ペナルティ: 残り時間を1秒減少
        if (this.currentTimeLeft !== null) {
            this.currentTimeLeft = Math.max(0, this.currentTimeLeft - 1);
            this.updateTimerDisplay();
        }
        this.score = Math.max(0, this.score - 25);

        // エフェクト
        this.showEffect('wrong');
        cardElement.classList.add('wrong');

        setTimeout(() => {
            cardElement.classList.remove('wrong');
            this.isProcessing = false;
        }, 500);

        this.updateScore();
    }

    handleTimeout() {
        this.wrongCount++;
        this.score = Math.max(0, this.score - 50);
        this.stopSpeaking();
        this.missedPractices.push(this.selectedPractices[this.currentIndex]);

        // タイムアウトメッセージ表示
        const message = document.createElement('div');
        message.className = 'timeout-message';
        message.textContent = '時間切れ！';
        document.body.appendChild(message);

        setTimeout(() => {
            message.remove();
        }, 2000);

        // 正解のカードをハイライト
        const currentPractice = this.selectedPractices[this.currentIndex];
        const cards = this.cardsArea.querySelectorAll('.card');
        cards.forEach(card => {
            if (card.dataset.name === currentPractice.name) {
                card.style.background = 'var(--accent-color)';
                card.style.color = 'white';
                setTimeout(() => {
                    card.classList.add('disabled');
                    card.style.visibility = 'hidden';
                }, 1500);
            }
        });

        // 失敗上限チェック
        if (this.checkMissLimit()) return;

        // 次の問題へ
        setTimeout(() => {
            this.currentIndex++;
            this.updateScore();
            this.updateRemaining();
            this.nextQuestion();
        }, 2000);
    }

    checkMissLimit() {
        this.renderLives();
        const settings = this.difficultySettings[this.difficulty];
        if (settings.missLimit !== null && this.wrongCount >= settings.missLimit) {
            this.clearTimer();
            this.stopSpeaking();
            setTimeout(() => {
                this.endGame();
            }, 1000);
            return true;
        }
        return false;
    }

    renderLives() {
        const settings = this.difficultySettings[this.difficulty];
        this.livesArea.innerHTML = '';
        if (settings.missLimit === null) {
            this.livesArea.textContent = '\u2665 \u221e';
            return;
        }
        for (let i = 0; i < settings.missLimit; i++) {
            const heart = document.createElement('span');
            heart.className = 'life-heart' + (i < settings.missLimit - this.wrongCount ? '' : ' lost');
            heart.textContent = '\u2665';
            this.livesArea.appendChild(heart);
        }
    }

    startTimer() {
        this.clearTimer();

        const settings = this.difficultySettings[this.difficulty];
        if (settings.timeLimit === null) {
            this.timerElement.textContent = '--';
            return;
        }

        this.currentTimeLeft = settings.timeLimit;
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.currentTimeLeft--;
            this.updateTimerDisplay();

            if (this.currentTimeLeft <= 0) {
                this.clearTimer();
                this.handleTimeout();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        this.timerElement.textContent = this.currentTimeLeft;

        // 警告色
        this.timerElement.classList.remove('warning', 'danger');
        if (this.currentTimeLeft <= 5) {
            this.timerElement.classList.add('danger');
        } else if (this.currentTimeLeft <= 10) {
            this.timerElement.classList.add('warning');
        }
    }

    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.timerElement.classList.remove('warning', 'danger');
    }

    showEffect(type) {
        this.effectOverlay.classList.remove('hidden', 'correct', 'wrong');
        this.effectOverlay.classList.add(type);

        setTimeout(() => {
            this.effectOverlay.classList.add('hidden');
            this.effectOverlay.classList.remove(type);
        }, 300);
    }

    updateScore() {
        this.scoreElement.textContent = this.score;
    }

    updateRemaining() {
        const remaining = this.selectedPractices.length - this.currentIndex;
        this.remainingElement.textContent = remaining;
    }

    endGame() {
        this.isGameOver = true;
        this.clearTimer();
        this.stopSpeaking();
        this.readingText.textContent = '';

        const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
        const answeredQuestions = this.correctCount + this.wrongCount;
        const accuracy = answeredQuestions > 0
            ? Math.round((this.correctCount / answeredQuestions) * 100)
            : 0;

        // 結果表示
        this.finalScoreElement.textContent = this.score;
        this.accuracyElement.textContent = `${accuracy}%`;
        this.totalTimeElement.textContent = this.formatTime(totalTime);

        // 結果メッセージ
        this.resultMessage.textContent = this.getResultMessage(accuracy);

        // ミスした札の一覧表示
        this.renderMissedList();

        // 結果音
        const isCleared = this.currentIndex >= this.selectedPractices.length;
        if (isCleared) {
            this.playFanfare();
        } else {
            this.playGameOverSound();
        }

        // 画面切り替え
        this.gameScreen.classList.add('hidden');
        this.resultScreen.classList.remove('hidden');
    }

    playFanfare() {
        try {
            if (!this.audioContext) return;
            const ctx = this.audioContext;
            const now = ctx.currentTime;

            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0, now + i * 0.15);
                gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.02);
                gain.gain.linearRampToValueAtTime(0.1, now + i * 0.15 + 0.12);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.4);
            });

            // 最後の和音
            const chord = [1047, 1319, 1568];
            chord.forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0, now + 0.6);
                gain.gain.linearRampToValueAtTime(0.12, now + 0.65);
                gain.gain.linearRampToValueAtTime(0, now + 1.5);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + 0.6);
                osc.stop(now + 1.5);
            });
        } catch (e) {
            console.error('ファンファーレ再生エラー:', e);
        }
    }

    playGameOverSound() {
        try {
            if (!this.audioContext) return;
            const ctx = this.audioContext;
            const now = ctx.currentTime;

            const notes = [440, 415, 370, 311];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.3);
                gain.gain.setValueAtTime(0, now + i * 0.3);
                gain.gain.linearRampToValueAtTime(0.2, now + i * 0.3 + 0.02);
                gain.gain.linearRampToValueAtTime(0, now + i * 0.3 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.3);
                osc.stop(now + i * 0.3 + 0.3);
            });

            // 低い持続音
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(147, now + 1.2);
            gain.gain.setValueAtTime(0, now + 1.2);
            gain.gain.linearRampToValueAtTime(0.2, now + 1.25);
            gain.gain.linearRampToValueAtTime(0, now + 2.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + 1.2);
            osc.stop(now + 2.2);
        } catch (e) {
            console.error('ゲームオーバー音再生エラー:', e);
        }
    }

    renderMissedList() {
        const container = document.getElementById('missed-list');
        container.innerHTML = '';
        if (this.missedPractices.length === 0) return;

        const title = document.createElement('h3');
        title.textContent = `取れなかった札（${this.missedPractices.length}枚）`;
        container.appendChild(title);

        this.missedPractices.forEach(p => {
            const wrapper = p.url ? document.createElement('a') : document.createElement('div');
            wrapper.className = 'missed-item';
            if (p.url) {
                wrapper.href = p.url;
                wrapper.target = '_blank';
                wrapper.rel = 'noopener noreferrer';
            }
            const name = document.createElement('div');
            name.className = 'missed-name';
            name.textContent = p.alias ? `${p.name}（${p.alias}）` : p.name;
            const desc = document.createElement('div');
            desc.className = 'missed-desc';
            desc.textContent = p.description;
            wrapper.appendChild(name);
            wrapper.appendChild(desc);
            if (p.url) {
                const url = document.createElement('div');
                url.className = 'missed-url';
                url.textContent = p.url;
                wrapper.appendChild(url);
            }
            container.appendChild(wrapper);
        });
    }

    getResultMessage(accuracy) {
        if (accuracy === 100) return '完璧！あなたはアジャイルマスターです！';
        if (accuracy >= 80) return '素晴らしい！アジャイルの達人ですね！';
        if (accuracy >= 60) return 'よくできました！さらに学習を続けましょう！';
        if (accuracy >= 40) return 'まずまずです。もう少し練習しましょう！';
        return 'がんばりましょう！繰り返し学習が大切です！';
    }

    formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        if (min > 0) {
            return `${min}分${sec}秒`;
        }
        return `${sec}秒`;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // カテゴリの短縮名を取得
    getCategoryShortName(category) {
        const shortNames = {
            'スクラム': 'スクラム',
            'スクラム(補完)': '補完',
            'XP': 'XP',
            '価値探索': '価値探索',
            'チームビルディング': 'チーム'
        };
        return shortNames[category] || category;
    }

    // カテゴリに応じたCSSクラスを取得
    getCategoryClass(category) {
        const classes = {
            'スクラム': 'cat-scrum',
            'スクラム(補完)': 'cat-scrum-ext',
            'XP': 'cat-xp',
            '価値探索': 'cat-value',
            'チームビルディング': 'cat-team'
        };
        return classes[category] || '';
    }
}

// ゲーム初期化
window.addEventListener('beforeunload', () => {
    speechSynthesis.cancel();
});

document.addEventListener('DOMContentLoaded', () => {
    speechSynthesis.cancel();
    new AgilishGame();
});
