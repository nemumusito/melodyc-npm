// グローバル変数の定義
let audioContext;
let currentInstrument;
let currentInput = null;
let analyser;
let dataArray;
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
    
    WebMidi.inputs.forEach(input => {
        const option = document.createElement('option');
        option.value = input.id;
        option.textContent = input.name;
        select.appendChild(option);
    });
}

// オーディオコンテキストの最適化設定
async function optimizeAudioContext() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    if (ctx.state === 'suspended') {
        const resumeAudio = async () => {
            await ctx.resume();
            console.log('AudioContext resumed');
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
        };
        
        document.addEventListener('click', resumeAudio);
        document.addEventListener('touchstart', resumeAudio);
    }
    
    return ctx;
}

// 音源の初期化
async function initializeInstrument(audioContext, instrumentName) {
    try {
        console.log(`Loading instrument: ${instrumentName}`);
        
        // 既存の音源を切断
        if (currentInstrument) {
            console.log('Disconnecting old instrument');
            try {
                currentInstrument.disconnect();
                await new Promise(resolve => setTimeout(resolve, 100)); // 切断の完了を待機
            } catch (error) {
                console.warn('Error disconnecting old instrument:', error);
            }
								}

        // 新しい音源をロード
        const instrument = await Soundfont.instrument(audioContext, instrumentName, {
            soundfont: 'MusyngKite',
            format: 'mp3',
            nameToUrl: (name, soundfont, format) => {
                const fixedName = name.replace(/_/g, '-');
                return `https://gleitz.github.io/midi-js-soundfonts/${soundfont}/${fixedName}-${format}.js`;
            }
								});

        // 音源の出力をアナライザーに接続
        try {
            instrument.connect(analyser);
            console.log('Audio routing completed');
            
            // 接続確認のためのテスト音を再生（無音）
            await instrument.play('C4', 0, { gain: 0.01, duration: 0.1 });
            console.log('Audio routing verified');
								} catch (error) {
            console.error('Error connecting instrument to analyser:', error);
            try {
                // アナライザーへの接続に失敗した場合、直接出力に接続を試みる
                instrument.disconnect();
                instrument.connect(audioContext.destination);
                await instrument.play('C4', 0, { gain: 0.01, duration: 0.1 });
                console.log('Direct audio routing successful');
												} catch (secondError) {
																console.error('Failed to establish audio routing:', secondError);
																throw new Error('音源の接続に失敗しました');
												}
								}

								console.log(`Instrument ${instrumentName} loaded successfully`);
								return instrument;
				} catch (error) {
								console.error(`Failed to load instrument: ${instrumentName}`, error);
								console.error('Detailed error:', error.message);
								throw error;
				}
}

// 音を再生する共通関数
function playNote(note, velocity = 1.5) {
    if (currentInstrument && note) {
        try {
            console.log(`Playing note: ${note} with velocity: ${velocity}`);
            return currentInstrument.play(note, 0, { gain: velocity });
        } catch (error) {
            console.error(`Error playing note ${note}:`, error);
        }
    }
}

// 音を停止する共通関数
function stopNote(note) {
    if (currentInstrument && note) {
        try {
            console.log(`Stopping note: ${note}`);
            currentInstrument.stop(note);
        } catch (error) {
            console.error(`Error stopping note ${note}:`, error);
        }
    }
}

// キーの色をリセットする関数
function resetKeyColor(keyElement) {
    if (keyElement && keyElement.dataset.originalColor) {
        keyElement.style.removeProperty('background');
        keyElement.style.backgroundColor = keyElement.dataset.originalColor;
        keyElement.style.transition = 'background-color 0.1s ease';
    }
}

// キーの色を変更する関数
function setKeyColor(keyElement, isPressed) {
    if (!keyElement) return;
    
    if (!keyElement.dataset.originalColor) {
        keyElement.dataset.originalColor = keyElement.classList.contains('black') ? 'black' : 'white';
    }
    
    keyElement.style.transition = 'background-color 0.1s ease';
    
    if (isPressed) {
        keyElement.style.background = `rgba(124, 181, 236, 0.8)`;
    } else {
        resetKeyColor(keyElement);
    }
}

// キーボードイベントのセットアップ
function setupKeyboardEvents() {
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        const note = key.dataset.note;
        key.dataset.originalColor = key.classList.contains('black') ? 'black' : 'white';

        // マウスイベント
        key.addEventListener('mousedown', (event) => {
            if (!activeNotes.has(note)) {
                playNote(note, 1.5);
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
                playNote(note, 1.5);
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
    console.log("Setting up MIDI listeners for:", input.name);

    input.addListener("noteon", "all", (e) => {
        console.log("MIDI Note ON:", e.note.identifier, "Velocity:", e.note.velocity);
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

    // すべてのノートを停止する関数
    function stopAllNotes() {
        activeNotes.forEach(note => {
            stopNote(note);
            const keyElement = document.querySelector(`[data-note="${note}"]`);
            setKeyColor(keyElement, false);
        });
        activeNotes.clear();
    }

    // 接続が切れた時やエラー時に全ての音を停止
    input.addListener("disconnect", () => {
        console.log("MIDI device disconnected");
        stopAllNotes();
    });
    
    input.addListener("error", (err) => {
        console.error("MIDI device error:", err);
        stopAllNotes();
    });
}

// 音源選択の処理
function setupInstrumentSelection() {
    const soundTypeSelect = document.getElementById('soundType');
				let isChanging = false;

    soundTypeSelect.addEventListener('change', async (e) => {
        if (isChanging) {
            console.log('音源切り替え処理が進行中です');
            return;
        }

        const selectedInstrument = e.target.value;
        const loadingIndicator = e.target;
        const originalValue = soundTypeSelect.value;
        
        try {
            isChanging = true;
            // UI要素を無効化
            loadingIndicator.disabled = true;
            loadingIndicator.style.opacity = '0.5';
            soundTypeSelect.style.cursor = 'wait';
            
            console.log(`Starting instrument change to: ${selectedInstrument}`);
            console.log('AudioContext state:', audioContext.state);
            
            // 現在の音を全て停止
            console.log('Stopping all active notes...');
            activeNotes.forEach(note => {
                stopNote(note);
                const keyElement = document.querySelector(`[data-note="${note}"]`);
                if (keyElement) {
                    resetKeyColor(keyElement);
                }
            });
            activeNotes.clear();
            
            // オーディオコンテキストの状態確認と再開
            if (audioContext.state === 'suspended') {
                console.log('Resuming AudioContext...');
                await audioContext.resume();
                await new Promise(resolve => setTimeout(resolve, 100)); // 状態変更の完了を待機
                
                if (audioContext.state !== 'running') {
                    throw new Error('オーディオコンテキストの再開に失敗しました');
                }
            }
            
            // 新しい音源を初期化
            console.log('Initializing new instrument...');
            const newInstrument = await initializeInstrument(audioContext, selectedInstrument);
            
            // 現在の音源を更新
            currentInstrument = newInstrument;
												console.log(`Successfully changed to ${selectedInstrument}`);
												
								} catch (error) {
												console.error(`Instrument change failed:`, error);
												// エラー時は選択を元に戻す
												soundTypeSelect.value = originalValue;
												alert(`音源の切り替えに失敗しました。\nエラー: ${error.message}\n\nページを更新して再度お試しください。`);
												
												// オーディオコンテキストのリセットを試みる
												try {
																await audioContext.close();
																audioContext = await optimizeAudioContext();
																analyser = audioContext.createAnalyser();
																analyser.fftSize = 2048;
																dataArray = new Uint8Array(analyser.frequencyBinCount);
																analyser.connect(audioContext.destination);
																console.log('AudioContext reset completed');
												} catch (resetError) {
																console.error('Failed to reset AudioContext:', resetError);
												}
								} finally {
												// UI要素を再有効化
												loadingIndicator.disabled = false;
												loadingIndicator.style.opacity = '1';
												soundTypeSelect.style.cursor = '';
												isChanging = false;
								}
				});
}

// MIDIデバイス選択の処理
function setupMIDIDeviceSelection() {
    const midiSelect = document.getElementById('midiInput');

    // MIDIデバイスの選択変更時の処理
    midiSelect.addEventListener('change', async (e) => {
        try {
            // 既存のリスナーを削除
            if (currentInput) {
                console.log("Removing listeners from previous input:", currentInput.name);
                try {
                    currentInput.removeListener("noteon", "all");
                    currentInput.removeListener("noteoff", "all");
                    currentInput.removeListener("disconnect");
                    currentInput.removeListener("error");
                } catch (err) {
                    console.warn("Error removing listeners:", err);
                }
                currentInput = null;
            }

            const selectedId = e.target.value;
            if (!selectedId) {
                console.log("No MIDI device selected");
                return;
            }

            // 新しいMIDIデバイスを設定
            currentInput = WebMidi.getInputById(selectedId);
            if (!currentInput) {
                throw new Error(`MIDI device with ID ${selectedId} not found`);
            }

            console.log("Selected MIDI device:", {
                name: currentInput.name,
                manufacturer: currentInput.manufacturer,
                state: currentInput.state,
                connection: currentInput.connection
            });

            // オーディオコンテキストの状態確認
            if (audioContext.state === 'suspended') {
                console.log("Resuming AudioContext...");
                await audioContext.resume();
            }

            // MIDIイベントリスナーを設定
            setupMIDIEvents(currentInput);
            console.log("MIDI device setup completed");

        } catch (error) {
            console.error("Error setting up MIDI device:", error);
            alert('MIDIデバイスの設定に失敗しました。\n' + error.message);
            midiSelect.value = ''; // 選択をリセット
            currentInput = null;
        }
    });

    // 初期状態のMIDIデバイスリストを更新
    updateMIDIInputs();
}

// アプリケーションの初期化
async function initializeApp() {
    try {
        // WebMIDIの初期化
        await WebMidi.enable({ sysex: true });
        console.log("WebMidi enabled successfully!");
        console.log("Available MIDI devices:", WebMidi.inputs.map(input => input.name));
        
        // オーディオコンテキストの初期化
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext created:", audioContext.state);
        
        // ユーザーインタラクションを待つ
        if (audioContext.state === 'suspended') {
            console.log('Waiting for user interaction...');
            const resumeAudioContext = async () => {
                await audioContext.resume();
                console.log('AudioContext resumed:', audioContext.state);
                document.removeEventListener('click', resumeAudioContext);
                document.removeEventListener('touchstart', resumeAudioContext);
            };
            document.addEventListener('click', resumeAudioContext);
            document.addEventListener('touchstart', resumeAudioContext);
        }
        
        // オーディオグラフの設定
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.connect(audioContext.destination);
        
        // Soundfontの初期化を試行
        console.log("Loading initial instrument...");
        try {
            currentInstrument = await Soundfont.instrument(audioContext, 'acoustic_grand_piano', {
                soundfont: 'MusyngKite',
                format: 'mp3'
            });
            currentInstrument.connect(analyser);
            console.log("Initial instrument loaded successfully");
            
            // 無音のテスト音を鳴らして接続を確認
            await currentInstrument.play('C4', 0, { gain: 0.01, duration: 0.1 });
            console.log("Audio routing verified");
        } catch (error) {
            console.error("Failed to load initial instrument:", error);
            alert('初期音源の読み込みに失敗しました。ページを更新してもう一度お試しください。');
            throw error;
        }
        
        // 各種セットアップ
        setupKeyboardEvents();
        setupInstrumentSelection();
        setupMIDIDeviceSelection();
        drawVisualizer();

    } catch (error) {
        console.error("Initialization failed:", error);
        alert('アプリケーションの初期化に失敗しました。ページを更新してもう一度お試しください。');
        throw error;
    }
}

// アプリケーションの起動
initializeApp().catch(err => {
    console.error("Application startup failed:", err);
    document.body.innerHTML += '<p class="error">アプリケーションの起動に失敗しました。</p>';
});