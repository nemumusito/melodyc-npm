// グローバル変数の定義
let audioContext = null;
let currentInstrument = null;
let currentInput = null;
let analyser = null;
let dataArray = null;
const activeNotes = new Set();

// オーディオビジュアライザーの設定
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');

// キャンバスのサイズをウィンドウに合わせる
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ビジュアライザーの描画
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    
    if (!analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        barHeight = dataArray[i] * 1.5;
        
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#7cb5ec');
        gradient.addColorStop(1, '#4a90e2');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
    }
}

// MIDIデバイスの選択肢を更新する関数
function updateMIDIInputs() {
    const select = document.getElementById('midiInput');
    select.innerHTML = '<option value="">MIDIデバイスを選択してください</option>';
    
    if (WebMidi.inputs.length === 0) {
        select.innerHTML += '<option value="" disabled>MIDIデバイスが見つかりません</option>';
        return;
    }
    
    WebMidi.inputs.forEach(input => {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name;
        select.appendChild(option);
    });
}

// オーディオコンテキストの初期化
async function initializeAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
            console.log('AudioContext resumed successfully');
        } catch (error) {
            console.error('Failed to resume AudioContext:', error);
            throw error;
        }
    }

    if (!analyser) {
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.connect(audioContext.destination);
    }

    return audioContext;
}

// 音源の初期化
async function initializeInstrument() {
    try {
        console.log('Initializing piano...');
        
        // オーディオコンテキストの初期化を確認
        await initializeAudioContext();

        // グランドピアノの音源をロード
        currentInstrument = await Soundfont.instrument(audioContext, 'acoustic_grand_piano', {
            soundfont: 'MusyngKite',
            format: 'mp3',
            gain: 2.0
        });

        // アナライザーに接続
        currentInstrument.connect(analyser);
        
        console.log('Piano initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize piano:', error);
        return false;
    }
}

// 音を再生する共通関数
async function playNote(note, velocity = 0.7) {
    if (!currentInstrument || !note) return;
    
    try {
        console.log(`Playing note: ${note} with velocity: ${velocity}`);
        await currentInstrument.play(note, 0, { gain: velocity });
    } catch (error) {
        console.error(`Error playing note ${note}:`, error);
    }
}

// 音を停止する共通関数
function stopNote(note) {
    if (!currentInstrument || !note) return;
    
    try {
        console.log(`Stopping note: ${note}`);
        currentInstrument.stop();
    } catch (error) {
        console.error(`Error stopping note ${note}:`, error);
    }
}

// キーの色を変更する関数
function setKeyColor(keyElement, isPressed) {
    if (!keyElement) return;
    
    const isBlack = keyElement.classList.contains('black');
    keyElement.style.backgroundColor = isPressed ? '#7cb5ec' : (isBlack ? '#000' : '#fff');
}

// キーボードイベントのセットアップ
function setupKeyboardEvents() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        const note = key.dataset.note;

        // マウスイベント
        key.addEventListener('mousedown', (event) => {
            if (!activeNotes.has(note)) {
                playNote(note);
                setKeyColor(event.target, true);
                activeNotes.add(note);
            }
        });

        const handleNoteOff = (event) => {
            if (activeNotes.has(note)) {
                stopNote(note);
                setKeyColor(event.target, false);
                activeNotes.delete(note);
            }
        };

        key.addEventListener('mouseup', handleNoteOff);
        key.addEventListener('mouseleave', handleNoteOff);

        // タッチイベント
        key.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!activeNotes.has(note)) {
                playNote(note);
                setKeyColor(e.target, true);
                activeNotes.add(note);
            }
        });

        key.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleNoteOff(e);
        });
    });

    // ページがフォーカスを失った時に全ての音を停止
    window.addEventListener('blur', () => {
        activeNotes.forEach(note => {
            stopNote(note);
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            setKeyColor(keyElement, false);
        });
        activeNotes.clear();
    });
}

// MIDIイベントのセットアップ
function setupMIDIEvents(input) {
    if (!input) return;
    
    console.log("Setting up MIDI listeners for:", input.name);

    input.addListener("noteon", "all", (e) => {
        const note = e.note.identifier;
        const keyElement = document.querySelector(`[data-note="${note}"]`);
        
        if (!activeNotes.has(note)) {
            playNote(note, e.note.velocity);
            setKeyColor(keyElement, true);
            activeNotes.add(note);
        }
    });

    input.addListener("noteoff", "all", (e) => {
        const note = e.note.identifier;
        const keyElement = document.querySelector(`[data-note="${note}"]`);
        
        if (activeNotes.has(note)) {
            stopNote(note);
            setKeyColor(keyElement, false);
            activeNotes.delete(note);
        }
    });
}

// MIDIデバイス選択の処理
function setupMIDIDeviceSelection() {
    const midiSelect = document.getElementById('midiInput');
    
    midiSelect.addEventListener('change', async (e) => {
        try {
            if (currentInput) {
                currentInput.removeListener();
            }

            const selectedId = e.target.value;
            if (!selectedId) {
                console.log("No MIDI device selected");
                return;
            }

            currentInput = WebMidi.getInputById(selectedId);
            if (!currentInput) {
                throw new Error(`MIDI device with ID ${selectedId} not found`);
            }

            setupMIDIEvents(currentInput);
            console.log("MIDI device setup completed");

        } catch (error) {
            console.error("Error setting up MIDI device:", error);
            alert('MIDIデバイスの設定に失敗しました。\n' + error.message);
            midiSelect.value = '';
            currentInput = null;
        }
    });

    // 初期MIDIデバイスリストの更新
    updateMIDIInputs();
}

// アプリケーションの初期化
async function initializeApp() {
    try {
        // WebMIDIの初期化
        await WebMidi.enable({ sysex: true }).catch(error => {
            console.warn('WebMIDI initialization failed:', error);
            document.querySelector('.controls').insertAdjacentHTML('afterbegin',
                '<div class="error-message" style="color: #ff4444; margin-bottom: 10px;">' +
                'MIDIデバイスの初期化に失敗しました。以下をご確認ください：<br>' +
                '1. ブラウザがWebMIDI APIをサポートしているか<br>' +
                '2. MIDIデバイスが正しく接続されているか' +
                '</div>'
            );
        });
        
        // オーディオコンテキストの初期化
        await initializeAudioContext();
        
        // グランドピアノの初期化
        const success = await initializeInstrument();
        if (!success) {
            throw new Error('Failed to initialize piano');
        }
        
        // 各種セットアップ
        setupKeyboardEvents();
        setupMIDIDeviceSelection();
        drawVisualizer();
        
        // ユーザーインタラクションを待つ
        document.addEventListener('click', async () => {
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
        }, { once: true });
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Initialization failed:', error);
        alert('アプリケーションの初期化に失敗しました。ページを更新してもう一度お試しください。');
    }
}

// アプリケーションの起動
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(console.error);
});
