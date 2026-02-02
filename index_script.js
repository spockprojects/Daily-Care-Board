const translations = 
{
    pl:
    {
        nav_main: "Główna", nav_health: "Zdrowie", nav_calendar: "Kalendarz",
        btn_note: "📝 Notatka", btn_todo: "📋 Lista To-Do", btn_reminder: "⏰ Przypomnienie", btn_chart: "📊 Wykres",
        health_water: "💧 Nawodnienie", health_kcal: "🔥 Kalorie", health_steps: "👣 Kroki", health_sleep: "💤 Sen",
        goal: "Cel", unit_ml: "ml", btn_add: "+", btn_reset: "Reset", btn_update: "Aktualizuj", btn_set: "Ustaw",
        profile_title: "👤 Twój Profil", label_gender: "Płeć:", label_weight: "Waga (kg):", label_height: "Wzrost (cm):",
        label_age: "Wiek (lat):", opt_male: "Mężczyzna", opt_female: "Kobieta", btn_calc: "Oblicz i Zapisz",
        res_water: "Sugerowana woda",
        widget_note: "📝 Notatka", widget_todo: "✅ Lista To-Do", widget_reminder: "⏰ Przypomnienie",
        rem_msg_placeholder: "Treść przypomnienia...", rem_time_label: "Czas:", rem_repeat: "Powtarzaj",
        rem_every: "Co ile:", rem_unit_min: "Minut", rem_unit_hour: "Godzin", rem_unit_day: "Dni", rem_unit_month: "Miesięcy",
        rem_btn_set: "Aktywuj", rem_status_active: "Aktywne na:",
        alert_prefix: "🔔 PRZYPOMNIENIE:",
        days_short: ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"],
        prompt_goal: "Wpisz nowy cel dla:"
    },
    en:
    {
        nav_main: "Main", nav_health: "Health", nav_calendar: "Calendar",
        btn_note: "📝 Note", btn_todo: "📋 To-Do List", btn_reminder: "⏰ Reminder", btn_chart: "📊 Chart",
        health_water: "💧 Hydration", health_kcal: "🔥 Calories", health_steps: "👣 Steps", health_sleep: "💤 Sleep",
        goal: "Goal", unit_ml: "ml", btn_add: "+", btn_reset: "Reset", btn_update: "Update", btn_set: "Set",
        profile_title: "👤 Your Profile", label_gender: "Gender:", label_weight: "Weight (kg):", label_height: "Height (cm):",
        label_age: "Age (years):", opt_male: "Male", opt_female: "Female", btn_calc: "Calc & Save",
        res_water: "Suggested Water",
        widget_note: "📝 Note", widget_todo: "✅ To-Do List", widget_reminder: "⏰ Reminder",
        rem_msg_placeholder: "Reminder text...", rem_time_label: "Time:", rem_repeat: "Repeat",
        rem_every: "Every:", rem_unit_min: "Minutes", rem_unit_hour: "Hours", rem_unit_day: "Days", rem_unit_month: "Months",
        rem_btn_set: "Activate", rem_status_active: "Active for:",
        alert_prefix: "🔔 REMINDER:",
        days_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        prompt_goal: "Enter new goal for:"
    }
};

let currentLang = 'pl';
let isLogged = false;
let currentAuthMode = 'login';
let debounceTimer;

let remindersList = [];
let currentDate = new Date();
let currentTab = 'main';
let zIndexCounter = 10;
let goals = {water: 2000, kcal: 2000, steps: 10000, sleep: 8};
let currentStats = {water: 0, kcal: 0, steps: 0, sleep: 0};
let myChart = null;

window.onload = function()
{
    applyLanguage();
    checkSession();
    setInterval(checkReminders, 10000);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
};


async function apiCall(action, payload = {})
{
    payload.action = action;
    try
    {
        const response = await fetch('api.php',
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        return await response.json();
    }
    catch (error)
    {
        console.error("API Error:", error);
        return {status: "error", msg: "Connection failed"};
    }
}

async function checkSession()
{
    const res = await apiCall('check_session');
    if (res.status === 'logged_in')
    {
        isLogged = true;
        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('profile-btn').style.display = 'flex';
        loadDataFromDB();
    }
    else
    {
        isLogged = false;
        document.getElementById('auth-buttons').style.display = 'block';
        document.getElementById('profile-btn').style.display = 'none';
    }
}

function openAuthModal(mode)
{
    currentAuthMode = mode;
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-title').innerText = mode === 'login' ? 'Logowanie' : 'Rejestracja';
    document.getElementById('auth-switch').innerText = mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz konto? Zaloguj się';
}

function toggleAuthMode()
{
    openAuthModal(currentAuthMode === 'login' ? 'register' : 'login');
}

async function submitAuth()
{
    const user = document.getElementById('auth-username').value;
    const pass = document.getElementById('auth-password').value;
    if(!user || !pass) return alert("Wypełnij pola");

    const res = await apiCall(currentAuthMode, { username: user, password: pass });
    
    if (res.status === 'success')
    {
        if(currentAuthMode === 'register')
        {
            alert(res.msg);
            toggleAuthMode();
        }
        else
        {
            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('auth-username').value = '';
            document.getElementById('auth-password').value = '';
            checkSession();
        }
    }
    else
    {
        alert(res.msg);
    }
}

async function logout()
{
    await apiCall('logout');
    location.reload(); 
}

async function loadDataFromDB()
{
    const wRes = await apiCall('load_widgets');
    if (wRes.status === 'success')
    {
        document.getElementById('main-tab').innerHTML = '';
        remindersList = []; 
        wRes.widgets.forEach(w =>
        {
            restoreWidget(w)
        });
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }

    const sRes = await apiCall('load_stats', { date: new Date().toISOString().slice(0,10) });
    if (sRes.status === 'success')
    {
        const d = sRes.data;
        currentStats =
        { 
            water: parseInt(d.water_current), 
            kcal: parseInt(d.kcal_current), 
            steps: parseInt(d.steps_current), 
            sleep: parseFloat(d.sleep_current) 
        };
        goals =
        {
            water: parseInt(d.water_goal),
            kcal: parseInt(d.kcal_goal),
            steps: parseInt(d.steps_goal),
            sleep: parseFloat(d.sleep_goal)
        };
        updateHealthUI();
    }
}

function saveStatsToDB()
{
    if (!isLogged) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() =>
    {
        apiCall('update_stats', { stats: currentStats, goals: goals });
    }, 1000); 
}

function toggleLanguage()
{
    currentLang = currentLang === 'pl' ? 'en' : 'pl';
    applyLanguage();
}

function applyLanguage()
{
    const t = translations[currentLang];
    document.querySelectorAll('[data-lang]').forEach(el =>
    {
        const key = el.getAttribute('data-lang');
        if (t[key]) el.innerText = t[key];
    });
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

function switchTab(tabName)
{
    document.querySelectorAll('.tab-content').forEach(el =>
    {
        el.style.display = 'none';
        el.classList.remove('active-tab');
    });
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`${tabName}-tab`).style.display = 'block';
    document.getElementById(`${tabName}-tab`).classList.add('active-tab');
    document.querySelector(`.nav-btn[onclick="switchTab('${tabName}')"]`).classList.add('active');
    currentTab = tabName;
}

function toggleProfileModal()
{
    const modal = document.getElementById('profile-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

function toggleCollapse(btn)
{
    const widget = btn.closest('.widget');
    widget.classList.toggle('collapsed');
}

function calculateProfile()
{
    const gender = document.getElementById('gender').value;
    const weight = parseFloat(document.getElementById('weight').value);
    const height = parseFloat(document.getElementById('height').value);
    const age = parseFloat(document.getElementById('age').value);

    if (!weight || !height || !age) return;

    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (gender === 'male' ? 5 : -161);
    
    let water = weight * 33;

    document.getElementById('res-water').innerText = Math.round(water);
    document.getElementById('res-bmr').innerText = Math.round(bmr);
    document.getElementById('results').style.display = 'block';

    goals.water = Math.round(water);
    goals.kcal = Math.round(bmr);
    updateHealthUI();
    saveStatsToDB();
}

function editGoal(type)
{
    const t = translations[currentLang];
    const newGoal = prompt(`${t.prompt_goal} ${type}`, goals[type]);
    if (newGoal && !isNaN(newGoal))
    {
        goals[type] = parseFloat(newGoal);
        updateHealthUI();
        saveStatsToDB();
    }
}

function updateHealthUI()
{
    const updateStat = (key, unit) =>
    {
        const goalEl = document.getElementById(`${key}-goal-disp`);
        const currEl = document.getElementById(`${key}-current`);
        const progEl = document.getElementById(`${key}-progress`);

        if(goalEl) goalEl.innerText = goals[key];
        if(currEl) currEl.innerText = `${currentStats[key]} ${unit}`;
        
        let perc = (currentStats[key] / goals[key]) * 100;
        if(progEl) progEl.value = perc > 100 ? 100 : perc;
    };

    updateStat('water', 'ml');
    updateStat('kcal', 'kcal');
    updateStat('steps', '');
    updateStat('sleep', 'h');

    const kcalGoal = goals.kcal || 0;
    const p = Math.round((kcalGoal * 0.25) / 4);
    const c = Math.round((kcalGoal * 0.50) / 4);
    const f = Math.round((kcalGoal * 0.25) / 9);

    const elP = document.getElementById('macro-p');
    const elC = document.getElementById('macro-c');
    const elF = document.getElementById('macro-f');

    if(elP) elP.innerText = p;
    if(elC) elC.innerText = c;
    if(elF) elF.innerText = f;
}

function addWater() { currentStats.water += parseFloat(document.getElementById('glass-size').value) || 250; updateHealthUI(); saveStatsToDB(); }
function resetWater() { currentStats.water = 0; updateHealthUI(); saveStatsToDB(); }
function addKcal() { currentStats.kcal += parseFloat(document.getElementById('kcal-input').value) || 0; document.getElementById('kcal-input').value = ''; updateHealthUI(); saveStatsToDB(); }
function updateSteps() { currentStats.steps = parseFloat(document.getElementById('steps-input').value) || 0; updateHealthUI(); saveStatsToDB(); }
function updateSleep() { currentStats.sleep = parseFloat(document.getElementById('sleep-input').value) || 0; updateHealthUI(); saveStatsToDB(); }

async function createWidget(type, loadedData = null)
{
    const t = translations[currentLang];
    const container = document.getElementById(currentTab === 'main' ? 'main-tab' : 'health-tab');
    
    const div = document.createElement('div');
    div.classList.add('widget', 'draggable');
    
    if (loadedData)
    {
        div.style.left = loadedData.pos_x + 'px';
        div.style.top = loadedData.pos_y + 'px';
        div.dataset.id = loadedData.id;
    }
    else
    {
        div.style.left = '50px'; div.style.top = '50px';
    }
    div.style.width = '280px'; div.style.height = '220px';

    let contentHTML = '', title = 'Widget';
    let uniqueId = loadedData ? loadedData.id : Date.now();
    let contentData = loadedData ? JSON.parse(loadedData.content) : {};

    if (type === 'note')
    {
        title = t.widget_note;
        const textVal = contentData.text || '';
        contentHTML = `<textarea class="note-content" placeholder="..." oninput="saveWidgetContent(this)">${textVal}</textarea>`;
    
    }
    else if (type === 'todo')
    {
        title = t.widget_todo;
        contentHTML =
        `
            <div class="todo-input-group">
                <input type="text" onkeypress="if(event.key==='Enter') addTodoItem(this)">
                <button onclick="addTodoItem(this.previousElementSibling)">+</button>
            </div>
            <div class="todo-list"><ul></ul></div>
            <div style="margin-top:auto; font-size:0.7rem; color:#777; cursor:pointer;" onclick="resetTodo(this)">Reset</div>
        `;
    
    }
    else if (type === 'reminder')
    {
        title = t.widget_reminder;
        const isActive = contentData.active || false;
        const displayForm = isActive ? 'none' : 'block';
        const msgVal = contentData.msg || '';
        
        contentHTML =
        `
            <div class="reminder-form" id="rem-form-${uniqueId}" style="display:${displayForm}">
                <textarea class="note-content" style="height:40px; border:1px solid #444; border-radius:4px; padding:5px;" placeholder="${t.rem_msg_placeholder}" id="rem-msg-${uniqueId}">${msgVal}</textarea>
                <label>${t.rem_time_label}</label>
                <input type="datetime-local" class="rem-date" id="rem-date-${uniqueId}" value="${contentData.dateStr || ''}">
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" class="rem-is-repeat" onchange="toggleRemInputs(${uniqueId})" id="rem-repeat-${uniqueId}" ${contentData.repeat ? 'checked' : ''}> <label>${t.rem_repeat}</label>
                </div>
                <div class="rem-repeat-opts" id="rem-opts-${uniqueId}" style="display:${contentData.repeat ? 'flex' : 'none'}; gap:5px;">
                    <input type="number" class="rem-interval" value="${contentData.interval || 1}" style="width:50px;" id="rem-interval-${uniqueId}">
                    <select class="rem-unit" id="rem-unit-${uniqueId}">
                        <option value="min" ${contentData.unit === 'min' ? 'selected' : ''}>${t.rem_unit_min}</option>
                        <option value="hour" ${contentData.unit === 'hour' ? 'selected' : ''}>${t.rem_unit_hour}</option>
                        <option value="day" ${contentData.unit === 'day' ? 'selected' : ''}>${t.rem_unit_day}</option>
                    </select>
                </div>
                <button onclick="activateReminder(${uniqueId}, true)" style="margin-top:5px;">${t.rem_btn_set}</button>
            </div>
            <div id="rem-status-${uniqueId}" class="reminder-next-info">${isActive ? (t.rem_status_active + ' ' + new Date(contentData.time).toLocaleString()) : ''}</div>
        `;
        
        if(isActive)
        {
            contentData.id = uniqueId;
            if(!remindersList.some(r => r.id == uniqueId)) remindersList.push(contentData);
        }
    }

    div.innerHTML = 
    `
        <div class="widget-header">
            <span>${title}</span>
            <div class="widget-controls">
                <span class="collapse-btn" onclick="toggleCollapse(this)">_</span>
                <span onclick="deleteWidget(this)">x</span>
            </div>
        </div>
        <div class="widget-body" data-type="${type}" data-uid="${uniqueId}">
            ${contentHTML}
        </div>
    `;

    container.appendChild(div);

    if (type === 'todo' && contentData.items)
    {
        const ul = div.querySelector('ul');
        contentData.items.forEach(item =>
        {
            const li = document.createElement('li');
            li.innerHTML = `<input type="checkbox" ${item.done ? 'checked' : ''} onchange="saveWidgetContent(this)"> <span>${item.text}</span>`;
            ul.appendChild(li);
        });
    }

    if (!loadedData && isLogged)
    {
        const res = await apiCall('save_widget',
        {
            type: type,
            content: { text: "" },
            x: 50, y: 50
        });
        if(res.status === 'success')
        {
            div.dataset.id = res.id;
        }
    }
}

function restoreWidget(dbWidget)
{
    createWidget(dbWidget.type, dbWidget);
}

function addTodoItem(input)
{
    if (!input.value.trim()) return;
    const ul = input.closest('.widget-body').querySelector('ul');
    const li = document.createElement('li');
    li.innerHTML = `<input type="checkbox" onchange="saveWidgetContent(this)"> <span>${input.value}</span>`;
    ul.appendChild(li);
    input.value = '';
    saveWidgetContent(input);
}

function resetTodo(btn)
{
    btn.closest('.widget-body').querySelector('ul').innerHTML = '';
    saveWidgetContent(btn);
}

function toggleRemInputs(id)
{
    const isRepeat = document.getElementById(`rem-repeat-${id}`).checked;
    document.getElementById(`rem-opts-${id}`).style.display = isRepeat ? 'flex' : 'none';
}

function activateReminder(id, fromButton = false)
{
    const msg = document.getElementById(`rem-msg-${id}`).value;
    const dateStr = document.getElementById(`rem-date-${id}`).value;
    const isRepeat = document.getElementById(`rem-repeat-${id}`).checked;
    
    if(!msg || !dateStr) return;

    const widgetBody = document.getElementById(`rem-form-${id}`).closest('.widget-body');

    const reminderObj =
    {
        id: id,
        msg: msg,
        dateStr: dateStr,
        time: new Date(dateStr).getTime(),
        repeat: isRepeat,
        active: true,
        interval: 1,
        unit: 'min'
    };

    if(isRepeat)
    {
        reminderObj.interval = parseInt(document.getElementById(`rem-interval-${id}`).value);
        reminderObj.unit = document.getElementById(`rem-unit-${id}`).value;
    }

    remindersList = remindersList.filter(r => r.id != id);
    remindersList.push(reminderObj);

    document.getElementById(`rem-form-${id}`).style.display = 'none';
    const statusDiv = document.getElementById(`rem-status-${id}`);
    statusDiv.innerText = `${translations[currentLang].rem_status_active} ${new Date(dateStr).toLocaleString()}`;
    
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());

    if(fromButton) saveWidgetContent(widgetBody);
}

function saveWidgetContent(element)
{
    if(!isLogged) return;
    
    let widget = element.closest('.widget');
    if(!widget) widget = element;

    const id = widget.dataset.id;
    if(!id) return;

    const type = widget.querySelector('.widget-body').dataset.type;
    const uid = widget.querySelector('.widget-body').dataset.uid;
    const x = parseInt(widget.style.left);
    const y = parseInt(widget.style.top);

    let content = {};

    if (type === 'note')
    {
        content = {text: widget.querySelector('textarea').value};
    } 
    else if (type === 'todo')
    {
        const items = [];
        widget.querySelectorAll('ul li').forEach(li =>
        {
            items.push(
            {
                done: li.querySelector('input').checked,
                text: li.querySelector('span').innerText
            });
        });
        content = {items: items};
    }
    else if (type === 'reminder')
    {
        const rem = remindersList.find(r => r.id == uid);
        if(rem)
        {
            content = rem;
        }
        else
        {
            content =
            {
                active: false,
                msg: widget.querySelector('textarea').value,
            };
        }
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() =>
    {
        apiCall('save_widget', {widget_id: id, content: content, x: x, y: y});
    }, 500);
}

async function deleteWidget(btn)
{
    const widget = btn.closest('.widget');
    if (isLogged && widget.dataset.id)
    {
        await apiCall('delete_widget', {widget_id: widget.dataset.id});
    }
    const uid = widget.querySelector('.widget-body').dataset.uid;
    remindersList = remindersList.filter(r => r.id != uid);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    
    widget.remove();
}

let activeItem = null, activeOffsetX = 0, activeOffsetY = 0;

document.addEventListener('mousedown', (e) =>
{
    if (e.target.closest('.widget-header') && !e.target.closest('.widget-controls'))
    {
        activeItem = e.target.closest('.widget');
        zIndexCounter++;
        activeItem.style.zIndex = zIndexCounter;
        const rect = activeItem.getBoundingClientRect();
        activeOffsetX = e.clientX - rect.left;
        activeOffsetY = e.clientY - rect.top;
        activeItem.querySelector('.widget-header').style.cursor = 'grabbing';
    }
});

document.addEventListener('mousemove', (e) =>
{
    if (activeItem)
    {
        const container = activeItem.parentElement;
        const cRect = container.getBoundingClientRect();
        activeItem.style.left = `${e.clientX - cRect.left - activeOffsetX}px`;
        activeItem.style.top = `${e.clientY - cRect.top - activeOffsetY}px`;
    }
});

document.addEventListener('mouseup', () =>
{
    if (activeItem)
    {
        activeItem.querySelector('.widget-header').style.cursor = 'grab';
        if (isLogged)
        {
            saveWidgetContent(activeItem.querySelector('.widget-body'));
        }
        activeItem = null;
    }
});

function changeMonth(delta)
{
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

function renderCalendar(year, month)
{
    const daysLabels = currentLang === 'pl' 
        ? ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    const grid = document.getElementById('calendar-grid');
    const headerGrid = document.getElementById('calendar-days-header');
    const monthYearLabel = document.getElementById('month-year');
    
    if(!grid) return; 

    grid.innerHTML = '';
    headerGrid.innerHTML = '';

    daysLabels.forEach(dayName =>
    {
        const div = document.createElement('div');
        div.innerText = dayName;
        headerGrid.appendChild(div);
    });

    const date = new Date(year, month, 1);
    const monthName = date.toLocaleString(currentLang, {month: 'long'});
    monthYearLabel.innerText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

    let firstDayIndex = date.getDay(); 
    let adjustedIndex = (firstDayIndex === 0 ? 7 : firstDayIndex) - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < adjustedIndex; i++)
    {
        const div = document.createElement('div');
        div.classList.add('calendar-day', 'empty');
        grid.appendChild(div);
    }

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++)
    {
        const div = document.createElement('div');
        div.classList.add('calendar-day');
        div.innerText = i;

        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear())
        {
            div.classList.add('today');
        }

        const checkDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const hasReminder = remindersList.some(rem => rem.active && rem.dateStr && rem.dateStr.startsWith(checkDateStr));
        
        if (hasReminder)
        {
            div.classList.add('has-reminder');
            div.title = "Reminder active";
        }

        grid.appendChild(div);
    }
}

function checkReminders()
{
    const now = Date.now();
    const t = translations[currentLang];
    let changed = false;

    remindersList.forEach(rem =>
    {
        if(rem.active && rem.time <= now)
        {
            alert(`${t.alert_prefix} ${rem.msg}`);
            
            if(rem.repeat)
            {
                let nextTime = new Date(rem.time);
                if(rem.unit === 'min') nextTime.setMinutes(nextTime.getMinutes() + rem.interval);
                if(rem.unit === 'hour') nextTime.setHours(nextTime.getHours() + rem.interval);
                if(rem.unit === 'day') nextTime.setDate(nextTime.getDate() + rem.interval);
                
                rem.time = nextTime.getTime();
                rem.dateStr = nextTime.toISOString().slice(0, 16); 
                
                const statusDiv = document.getElementById(`rem-status-${rem.id}`);
                if(statusDiv) statusDiv.innerText = `${t.rem_status_active} ${nextTime.toLocaleString()}`;
            }
            else
            {
                rem.active = false;
                const statusDiv = document.getElementById(`rem-status-${rem.id}`);
                if(statusDiv) statusDiv.innerText = "Done";
            }
            changed = true;
            
            const el = document.querySelector(`[data-uid="${rem.id}"]`);
            if(el) saveWidgetContent(el);
        }
    });

    if(changed) renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

function openChartModal()
{
    if (!isLogged) return alert("Musisz być zalogowany, aby zobaczyć statystyki.");
    document.getElementById('chart-modal').style.display = 'flex';
    loadChartData(); 
}

async function loadChartData()
{
    const type = document.getElementById('chart-type').value;
    const range = document.getElementById('chart-range').value;

    const res = await apiCall('get_chart_data', {type: type, range: range});

    if (res.status === 'success')
    {
        renderChart(res.data, type, range);
    }
    else
    {
        console.error("Błąd pobierania danych wykresu");
    }
}

function renderChart(data, type, range)
{
    const ctx = document.getElementById('myChart').getContext('2d');
    
    const labels = data.map(item => item.label);
    const values = data.map(item => parseFloat(item.value).toFixed(1));

    let color = '#7C68EE';
    let labelText = 'Wartość';
    
    if (type === 'water') {color = '#3498db'; labelText = 'Woda (ml)';}
    if (type === 'kcal') {color = '#e74c3c'; labelText = 'Kalorie';}
    if (type === 'steps') {color = '#2ecc71'; labelText = 'Kroki';}
    if (type === 'sleep') {color = '#9b59b6'; labelText = 'Sen (h)';}

    if (myChart)
    {
        myChart.destroy();
    }

    myChart = new Chart(ctx,
    {
        type: range === 'year' ? 'bar' : 'line',
        data:
        {
            labels: labels,
            datasets:
            [
                {
                    label: labelText,
                    data: values,
                    borderColor: color,
                    backgroundColor: range === 'year' ? color : (color + '33'),
                    borderWidth: 2,
                    tension: 0.3,
                    fill: range !== 'year'
                }
            ]
        },
        options:
        {
            responsive: true,
            maintainAspectRatio: false,
            scales:
            {
                y:
                {
                    beginAtZero: true,
                    grid: {color: '#444'},
                    ticks: {color: '#ccc'}
                },
                x:
                {
                    grid: {color: '#444'},
                    ticks: {color: '#ccc'}
                }
            },
            plugins:
            {
                legend: {labels: {color: '#fff'}}
            }
        }
    });
}
