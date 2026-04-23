const MY_API_KEY = "AIzaSyBQ5nPI4F-ATGGHXi5CmjAUCmpf05KPpZU"; // 本番では保護してください
const TARGET_HANDLE = '@r_____in__';
const CACHE_KEY = 'video_cache_v12';

let player, appStarted = false;
let allPlaylist = [], activePlaylist = [], playbackSequence =[], currentSeqIndex = 0;
let sortableInst = null, isShuffle = false, repeatMode = 0;
let editingPlaylist =[];
let tickInterval = null; 

// 画面回転監視処理
function checkOrientation() {
    const msg = document.getElementById('orientation-msg');
    if (window.innerWidth < window.innerHeight && window.matchMedia("(orientation: landscape)").matches) {
        msg.classList.replace('hidden', 'flex');
    } else {
        msg.classList.replace('flex', 'hidden');
    }
}
window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);

// YouTube Iframe API ロード
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        playerVars: { 'playsinline': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0, 'origin': window.location.origin },
        events: { 'onStateChange': onPlayerStateChange, 'onError': onPlayerError }
    });
}

async function startApp() {
    if (appStarted) return; appStarted = true;
    checkOrientation();

    const splash = document.getElementById('splash-screen');
    splash.classList.add('splash-fade-out');
    setTimeout(() => { splash.classList.add('hidden'); splash.classList.remove('flex'); }, 600);

    if (player && typeof player.playVideo === 'function') {
        try { player.mute(); player.loadVideoById('dQw4w9WgXcQ'); player.playVideo(); setTimeout(() => { player.pauseVideo(); player.unMute(); }, 200); } catch (e) {}
    }

    let apiKey = localStorage.getItem('yt_api_key') || MY_API_KEY;
    if (apiKey) { 
        document.getElementById('api-key-input').value = apiKey; 
        await initData(apiKey); 
    } else { 
        switchTab('edit'); 
    }
    updateStatusUI();
}

async function saveApiKey(e) {
    const key = document.getElementById('api-key-input').value.trim();
    if (!key) { alert('APIキーを入力してください。'); return; }
    localStorage.setItem('yt_api_key', key);
    
    const btn = e.currentTarget;
    const originalText = btn.innerText;
    btn.innerText = "保存中...";
    try {
        await initData(key);
        updateStatusUI();
        btn.innerText = "保存・適用完了！";
    } catch(err) {
        btn.innerText = "エラーが発生しました";
    }
    setTimeout(() => btn.innerText = originalText, 2000);
}

async function initData(apiKey) {
    const today = new Date().toISOString().split('T')[0];
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached && localStorage.getItem('last_fetch_date') === today) {
        allPlaylist = JSON.parse(cached);
    } else {
        await fetchFullPlaylist(apiKey);
    }
    updateActivePlaylist();
    if (activePlaylist.length > 0) playTrackBySequence(0, false);
}

async function fetchFullPlaylist(apiKey) {
    try {
        const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&forHandle=" + TARGET_HANDLE + "&key=" + apiKey);
        const chData = await chRes.json();
        if (!chData.items || chData.items.length === 0) { console.error('Channel not found or API error'); return; }
        const uploadsId = chData.items[0].contentDetails.relatedPlaylists.uploads;

        let allItems =[], nextPageToken = '';
        do {
            const url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=" + uploadsId + "&key=" + apiKey + (nextPageToken ? "&pageToken=" + nextPageToken : '');
            const plRes = await fetch(url);
            const plData = await plRes.json();
            allItems = allItems.concat(plData.items ||[]);
            nextPageToken = plData.nextPageToken || '';
        } while (nextPageToken);

        let allVideos =[];
        for (let i = 0; i < allItems.length; i += 50) {
            const chunk = allItems.slice(i, i + 50);
            const vIds = chunk.map(item => item.contentDetails.videoId).join(',');
            const vRes = await fetch("https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=" + vIds + "&key=" + apiKey);
            const vData = await vRes.json();
            if(vData.items) allVideos = allVideos.concat(vData.items);
        }

        allPlaylist = allVideos.filter(v => v.contentDetails.duration.includes('M')).map(v => ({
            id: v.id, title: v.snippet.title, thumb: v.snippet.thumbnails.medium.url,
            duration: parseISO8601(v.contentDetails.duration), description: v.snippet.description, isHidden: false
        }));
        localStorage.setItem(CACHE_KEY, JSON.stringify(allPlaylist));
        localStorage.setItem('last_fetch_date', new Date().toISOString().split('T')[0]);
        localStorage.setItem('last_fetch_datetime', new Date().toLocaleString());
    } catch (e) {
        console.error('fetchFullPlaylist error:', e);
        alert('プレイリストの取得に失敗しました。APIキーを確認してください。');
    }
}

function updateActivePlaylist(preserveTrackId = null) {
    activePlaylist = allPlaylist.filter(p => !p.isHidden);
    playbackSequence = activePlaylist.map((_, i) => i);
    if (isShuffle) playbackSequence.sort(() => Math.random() - 0.5);
    if (preserveTrackId) {
        const activeIndex = activePlaylist.findIndex(t => t.id === preserveTrackId);
        const seqIndex = playbackSequence.indexOf(activeIndex);
        currentSeqIndex = seqIndex !== -1 ? seqIndex : 0;
    }
    renderPlaylist();
}

function renderPlaylist() {
    const container = document.getElementById('playlist-container');
    container.innerHTML = activePlaylist.map((item, index) => {
        const isPlaying = (index === playbackSequence[currentSeqIndex]);
        const border = isPlaying ? 'border-white/40 bg-white/10' : 'border-transparent bg-white/5';
        return `<div id="track-${index}" onclick="playTrackByIndex(${index})" class="flex items-center gap-3 mb-2.5 p-2 rounded-xl h-[64px] transition-all border-2 ${border} cursor-pointer">
            <img src="${item.thumb}" class="h-full aspect-video object-cover rounded shadow flex-shrink-0">
            <div class="flex-1 min-w-0"><div class="text-[12px] font-bold truncate ${isPlaying ? 'text-white' : 'text-white/60'}">${item.title}</div><div class="text-[9px] text-white/40 mt-1 font-bold uppercase tracking-widest">TRACK ${index + 1} • ${item.duration}</div></div>
            ${isPlaying ? '<div class="w-2 h-2 bg-blue-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>' : ''}</div>`;
    }).join('');
}

function playTrackBySequence(seqIndex, autoPlay = true) {
    if (activePlaylist.length === 0) return;
    currentSeqIndex = seqIndex;
    const track = activePlaylist[playbackSequence[currentSeqIndex]];
    if (autoPlay) player.loadVideoById(track.id); else player.cueVideoById(track.id);
    renderPlaylist();
    const el = document.getElementById('track-' + playbackSequence[currentSeqIndex]);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function playTrackByIndex(activeIndex) {
    const s = playbackSequence.indexOf(activeIndex);
    if (s !== -1) playTrackBySequence(s, true);
}

function togglePlay() {
    if (activePlaylist.length === 0) return;
    player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
}

function playNext(m = false) {
    if (activePlaylist.length === 0) return;
    if (currentSeqIndex >= playbackSequence.length - 1) {
        if (repeatMode === 1 || isShuffle) playTrackBySequence(0, true);
        else playTrackBySequence(0, false);
    } else {
        playTrackBySequence(currentSeqIndex + 1, true);
    }
}

function playPrev() {
    if (activePlaylist.length === 0) return;
    if (currentSeqIndex <= 0) playTrackBySequence(playbackSequence.length - 1, true);
    else playTrackBySequence(currentSeqIndex - 1, true);
}

function onPlayerStateChange(e) {
    const play = document.getElementById('icon-play'), pause = document.getElementById('icon-pause');
    if (e.data === 1) { play.classList.add('hidden'); pause.classList.remove('hidden'); updateTick(); }
    else { play.classList.remove('hidden'); pause.classList.add('hidden'); }
    if (e.data === 0) { repeatMode === 2 ? playTrackBySequence(currentSeqIndex, true) : playNext(false); }
}

function onPlayerError() { setTimeout(() => playNext(false), 1000); }

function updateTick() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(() => {
        if (player.getPlayerState() !== 1) { clearInterval(tickInterval); tickInterval = null; return; }
        const curr = player.getCurrentTime(), total = player.getDuration();
        document.getElementById('current-time').innerText = formatSeconds(curr);
        document.getElementById('duration-total').innerText = formatSeconds(total);
        document.getElementById('seek-bar').value = (curr / total) * 100 || 0;
    }, 500);
}

document.getElementById('seek-bar').oninput = function () {
    player.seekTo(player.getDuration() * (this.value / 100));
    if (player.getPlayerState() === 1) updateTick();
};

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    const btn = document.getElementById('btn-repeat'), ind = document.getElementById('repeat-1-indicator');
    btn.classList.toggle('opacity-40', repeatMode === 0);
    btn.classList.toggle('opacity-100', repeatMode !== 0);
    ind.classList.toggle('hidden', repeatMode !== 2);
}

function toggleShuffle() {
    const currentTrackId = activePlaylist[playbackSequence[currentSeqIndex]]?.id;
    isShuffle = !isShuffle;
    document.getElementById('btn-shuffle').classList.toggle('opacity-40', !isShuffle);
    document.getElementById('btn-shuffle').classList.toggle('opacity-100', isShuffle);
    updateActivePlaylist(currentTrackId);
}

// === タブ切り替え処理 ===
function switchTab(tab) {
    // 全Viewを非表示
    ['player', 'links', 'edit'].forEach(id => {
        const view = document.getElementById('view-' + id);
        view.classList.add('hidden');
        view.classList.remove('flex');
        
        const nav = document.getElementById('nav-' + id);
        nav.classList.remove('text-white'); 
        nav.classList.add('text-white/30');
    });
    // 選択されたViewを表示 (flexにする)
    const activeView = document.getElementById('view-' + tab);
    activeView.classList.remove('hidden');
    activeView.classList.add('flex');
    
    document.getElementById('nav-' + tab).classList.replace('text-white/30', 'text-white');
}

// === モーダル・UI制御 ===
function openInfoModal() {
    if (activePlaylist.length === 0) return;
    const track = activePlaylist[playbackSequence[currentSeqIndex]];
    const modal = document.getElementById('info-modal');
    const box = document.getElementById('info-modal-box');
    
    document.getElementById('info-modal-content').innerHTML = (track.description || "No description.").replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-blue-400 underline">$1</a>');
    document.getElementById('info-modal-link').href = "https://www.youtube.com/watch?v=" + track.id;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95');
    }, 10);
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    const box = document.getElementById('info-modal-box');
    modal.classList.add('opacity-0');
    box.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('api-key-input');
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    document.getElementById('eye-icon').style.opacity = isText ? '0.4' : '1';
}

function openEditPlaylist() {
    editingPlaylist = JSON.parse(JSON.stringify(allPlaylist));
    renderEditPlaylist();
    const v = document.getElementById('view-edit-list');
    v.classList.remove('hidden');
    v.classList.add('flex');
    setTimeout(() => v.classList.remove('translate-y-full'), 10);
}

function closeEditPlaylist() {
    const v = document.getElementById('view-edit-list');
    v.classList.add('translate-y-full');
    setTimeout(() => {
        v.classList.add('hidden');
        v.classList.remove('flex');
    }, 300);
}

function renderEditPlaylist() {
    const container = document.getElementById('edit-playlist-container');
    const hLine = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
    const hSlash = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>';
    
    container.innerHTML = editingPlaylist.map((item, i) => `<div class="flex items-center gap-3 mb-3 p-2.5 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg transition-opacity ${item.isHidden ? 'opacity-40 grayscale' : ''}">
        <div class="drag-handle text-white/50 p-2 cursor-grab active:text-white transition-colors flex items-center justify-center -ml-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg></div>
        <img src="${item.thumb}" class="w-16 aspect-video object-cover rounded-lg shadow-sm">
        <div class="flex-1 truncate text-[12px] font-bold text-white/90 tracking-wide">${item.title}</div>
        <button onclick="toggleVisibility('${item.id}')" class="p-2.5 bg-white/5 border border-white/10 rounded-full text-white/80 active:bg-white/20 transition-all">${item.isHidden ? hSlash : hLine}</button></div>`).join('');
        
    if (sortableInst) sortableInst.destroy();
    sortableInst = new Sortable(container, { 
        handle: '.drag-handle', animation: 250, 
        ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', 
        fallbackTolerance: 5, delay: 150, delayOnTouchOnly: true,
        onEnd: (evt) => { 
            const item = editingPlaylist.splice(evt.oldIndex, 1)[0]; 
            editingPlaylist.splice(evt.newIndex, 0, item); 
        } 
    });
}

function toggleVisibility(id) {
    const item = editingPlaylist.find(p => p.id === id);
    if (item) { item.isHidden = !item.isHidden; renderEditPlaylist(); }
}

function saveEditedPlaylist() {
    allPlaylist = editingPlaylist;
    localStorage.setItem(CACHE_KEY, JSON.stringify(allPlaylist));
    const currentTrackId = activePlaylist[playbackSequence[currentSeqIndex]]?.id;
    updateActivePlaylist(currentTrackId);
    closeEditPlaylist();
}

function parseISO8601(d) { const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return formatSeconds(parseInt(m[1] || 0) * 3600 + parseInt(m[2] || 0) * 60 + parseInt(m[3] || 0)); }
function formatSeconds(s) { return Math.floor(s / 60) + ":" + Math.floor(s % 60).toString().padStart(2, '0'); }
function updateStatusUI() { document.getElementById('status-last-update').innerText = localStorage.getItem('last_fetch_datetime') || '未取得'; }

// === リンク確認モーダル用の処理 ===
let pendingUrl = '';

function confirmLink(url, siteName) {
    pendingUrl = url;
    document.getElementById('link-modal-text').innerHTML = `<span class="font-bold text-white text-base">${siteName}</span><br>を開きますか？`;
    
    document.getElementById('link-modal-btn').onclick = () => {
        window.open(pendingUrl, '_blank');
        closeLinkModal();
    };
    
    const modal = document.getElementById('link-modal');
    const box = document.getElementById('link-modal-box');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        box.classList.remove('scale-95');
        box.classList.add('scale-100');
    }, 10);
}

function closeLinkModal() {
    const modal = document.getElementById('link-modal');
    const box = document.getElementById('link-modal-box');
    
    modal.classList.add('opacity-0');
    box.classList.remove('scale-100');
    box.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}
