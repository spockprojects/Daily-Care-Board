// CONFIGURATION & TRANSLATIONS
const translations = 
{
    pl:
    {
        nav_main: "Główna", nav_health: "Zdrowie", nav_calendar: "Kalendarz",
        btn_note: "📝 Notatka", btn_todo: "📋 Lista TO-DO", btn_reminder: "⏰ Przypomnienie", btn_chart: "📊 Wykres",
        health_water: "💧 Nawodnienie", health_kcal: "🔥 Kalorie", health_steps: "👣 Kroki", health_sleep: "💤 Sen",
        goal: "Cel", unit_ml: "ml", btn_add: "+", btn_reset: "Reset", btn_update: "Aktualizuj", btn_set: "Ustaw",
        profile_title: "👤 Twój Profil", label_gender: "Płeć:", label_weight: "Waga (kg):", label_height: "Wzrost (cm):",
        label_age: "Wiek (lat):", opt_male: "Mężczyzna", opt_female: "Kobieta", btn_calc: "Oblicz i Zapisz",
        res_water: "Sugerowana woda",
        widget_note: "📝 Notatka", widget_todo: "✅ Lista TO-DO", widget_reminder: "⏰ Przypomnienie",
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
        btn_note: "📝 Note", btn_todo: "📋 TO-DO List", btn_reminder: "⏰ Reminder", btn_chart: "📊 Chart",
        health_water: "💧 Hydration", health_kcal: "🔥 Calories", health_steps: "👣 Steps", health_sleep: "💤 Sleep",
        goal: "Goal", unit_ml: "ml", btn_add: "+", btn_reset: "Reset", btn_update: "Update", btn_set: "Set",
        profile_title: "👤 Your Profile", label_gender: "Gender:", label_weight: "Weight (kg):", label_height: "Height (cm):",
        label_age: "Age (years):", opt_male: "Male", opt_female: "Female", btn_calc: "Calc & Save",
        res_water: "Suggested Water",
        widget_note: "📝 Note", widget_todo: "✅ TO-DO List", widget_reminder: "⏰ Reminder",
        rem_msg_placeholder: "Reminder text...", rem_time_label: "Time:", rem_repeat: "Repeat",
        rem_every: "Every:", rem_unit_min: "Minutes", rem_unit_hour: "Hours", rem_unit_day: "Days", rem_unit_month: "Months",
        rem_btn_set: "Activate", rem_status_active: "Active for:",
        alert_prefix: "🔔 REMINDER:",
        days_short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        prompt_goal: "Enter new goal for:"
    }
};

// GLOBAL STATE VARIABLES
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

// START FUNCTION (executed when the window finishes loading)
window.onload = function()
{
    applyLanguage();
    checkSession();
    setInterval(checkReminders, 10000);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
};

// API & AUTHENTICATION HANDLING

// generic async POST wrapper (PHP)
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
        return await response.json(); // return parsed JSON response
    }
    catch (error)
    {
        console.error("API Error:", error);
        return {status: "error", msg: "Connection failed"};
    }
}

// checks server-side session status
async function checkSession()
{
    const res = await apiCall('check_session');
    if (res.status === 'logged_in')
    {
        isLogged = true;
        // update UI for logged-in state
        document.getElementById('auth-buttons').style.display = 'none';
        document.getElementById('profile-btn').style.display = 'flex';
        loadDataFromDB(); // fetch user data
    }
    else
    {
        isLogged = false;
        // update UI for guest state
        document.getElementById('auth-buttons').style.display = 'block';
        document.getElementById('profile-btn').style.display = 'none';
    }
}

// opens the Login/Register modal
function openAuthModal(mode)
{
    currentAuthMode = mode;
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-title').innerText = mode === 'login' ? 'Logowanie' : 'Rejestracja';
    document.getElementById('auth-switch').innerText = mode === 'login' ? 'Nie masz konta? Zarejestruj się' : 'Masz konto? Zaloguj się';
}

// switches between Login and Register views within the modal
function toggleAuthMode()
{
    openAuthModal(currentAuthMode === 'login' ? 'register' : 'login');
}

// handles the form submission for auth (login or register)
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
            toggleAuthMode(); // switch to login after successful registration
        }
        else
        {
            // success login: close modal and clear inputs
            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('auth-username').value = '';
            document.getElementById('auth-password').value = '';
            checkSession();
        }
    }
    else
    {
        alert(res.msg); // show error message
    }
}

// logs the user out and reloads page
async function logout()
{
    await apiCall('logout');
    location.reload(); 
}

// DATA MANAGEMENT (LOAD/SAVE)

// loads widgets and daily stats from database
async function loadDataFromDB()
{
    // load widgets
    const wRes = await apiCall('load_widgets');
    if (wRes.status === 'success')
    {
        document.getElementById('main-tab').innerHTML = ''; // clear current widgets
        remindersList = []; 
        wRes.widgets.forEach(w =>
        {
            restoreWidget(w); // re-create each widget from DB data
        });
        // refresh calendar to show reminder dots
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }

    // load daily stats
    const sRes = await apiCall('load_stats', { date: new Date().toISOString().slice(0,10) });
    if (sRes.status === 'success')
    {
        const d = sRes.data;
        // parse database values into local state
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
        updateHealthUI(); // update health dashboard UI
    }
}

// saves current stats to DB with debouncing (waits 1s after last change)
function saveStatsToDB()
{
    if (!isLogged) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() =>
    {
        apiCall('update_stats', { stats: currentStats, goals: goals });
    }, 1000); 
}

// UI & NAVIGATION LOGIC

// toggles between Polish and English
function toggleLanguage()
{
    currentLang = currentLang === 'pl' ? 'en' : 'pl';
    applyLanguage();
}

// updates all text elements with `data-lang` attribute
function applyLanguage()
{
    const t = translations[currentLang];
    document.querySelectorAll('[data-lang]').forEach(el =>
    {
        const key = el.getAttribute('data-lang');
        if (t[key]) el.innerText = t[key];
    });
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // refresh calendar headers
}

// handles switching between Main, Health, and Calendar tabs
function switchTab(tabName)
{
    // hide all tabs
    document.querySelectorAll('.tab-content').forEach(el =>
    {
        el.style.display = 'none';
        el.classList.remove('active-tab');
    });
    // reset nav buttons
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    // show selected tab
    document.getElementById(`${tabName}-tab`).style.display = 'block';
    document.getElementById(`${tabName}-tab`).classList.add('active-tab');
    document.querySelector(`.nav-btn[onclick="switchTab('${tabName}')"]`).classList.add('active');
    currentTab = tabName;
}

// toggles visibility of the profile calculator modal
function toggleProfileModal()
{
    const modal = document.getElementById('profile-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

// minimizes/expands a widget
function toggleCollapse(btn)
{
    const widget = btn.closest('.widget');
    widget.classList.toggle('collapsed');
}

// HEALTH CALCULATIONS & LOGIC

// calculates BMR (Basal Metabolic Rate) and suggested water intake
function calculateProfile()
{
    const gender = document.getElementById('gender').value;
    const weight = parseFloat(document.getElementById('weight').value);
    const height = parseFloat(document.getElementById('height').value);
    const age = parseFloat(document.getElementById('age').value);

    if (!weight || !height || !age) return;

    // Mifflin-St Jeor Equation for BMR
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (gender === 'male' ? 5 : -161);
    
    // simple water calculation (approx 33ml per kg)
    let water = weight * 33;

    // display results in modal
    document.getElementById('res-water').innerText = Math.round(water);
    document.getElementById('res-bmr').innerText = Math.round(bmr);
    document.getElementById('results').style.display = 'block';

    // update global goals
    goals.water = Math.round(water);
    goals.kcal = Math.round(bmr);
    updateHealthUI();
    saveStatsToDB();
}

// prompts user to manually edit a specific health goal
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

// updates the Health Dashboard UI (text, progress bars, macros)
function updateHealthUI()
{
    // helper function to update a single stat
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

    // calculate macros (Standard split: 50% Carbs, 25% Protein, 25% Fat)
    const kcalGoal = goals.kcal || 0;
    const p = Math.round((kcalGoal * 0.25) / 4);    // Protein = 4 kcal/g
    const c = Math.round((kcalGoal * 0.50) / 4);    // Carbs = 4 kcal/g
    const f = Math.round((kcalGoal * 0.25) / 9);    // Fat = 9 kcal/g

    const elP = document.getElementById('macro-p');
    const elC = document.getElementById('macro-c');
    const elF = document.getElementById('macro-f');

    if(elP) elP.innerText = p;
    if(elC) elC.innerText = c;
    if(elF) elF.innerText = f;
}

// helper functions for buttons to update specific stats
function addWater() { currentStats.water += parseFloat(document.getElementById('glass-size').value) || 250; updateHealthUI(); saveStatsToDB(); }
function resetWater() { currentStats.water = 0; updateHealthUI(); saveStatsToDB(); }
function addKcal() { currentStats.kcal += parseFloat(document.getElementById('kcal-input').value) || 0; document.getElementById('kcal-input').value = ''; updateHealthUI(); saveStatsToDB(); }
function updateSteps() { currentStats.steps = parseFloat(document.getElementById('steps-input').value) || 0; updateHealthUI(); saveStatsToDB(); }
function updateSleep() { currentStats.sleep = parseFloat(document.getElementById('sleep-input').value) || 0; updateHealthUI(); saveStatsToDB(); }

// WIDGET SYSTEM (Create, Restore, Logic)

// creates a new widget or restores one from DB
async function createWidget(type, loadedData = null)
{
    const t = translations[currentLang];
    const container = document.getElementById(currentTab === 'main' ? 'main-tab' : 'health-tab');
    
    // create DOM element for widget
    const div = document.createElement('div');
    div.classList.add('widget', 'draggable');
    
    // set position
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
    let uniqueId = loadedData ? loadedData.id : Date.now(); // temp ID if new
    let contentData = loadedData ? JSON.parse(loadedData.content) : {};

    // generate HTML based on widget type
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
        
        // complex HTML for reminder form and status
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
        
        // register active reminder in memory
        if(isActive)
        {
            contentData.id = uniqueId;
            if(!remindersList.some(r => r.id == uniqueId)) remindersList.push(contentData);
        }
    }

    // assemble final widget structure
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

    // hydrate TODO List if items exist
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

    // save new widget to DB immediately to get an ID
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

// wrapper to restore a widget from DB object
function restoreWidget(dbWidget)
{
    createWidget(dbWidget.type, dbWidget);
}

// adds an item to the TO-DO list
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

// clears all items in a TO-DO list
function resetTodo(btn)
{
    btn.closest('.widget-body').querySelector('ul').innerHTML = '';
    saveWidgetContent(btn);
}

// show/hide repeat options in reminder widget
function toggleRemInputs(id)
{
    const isRepeat = document.getElementById(`rem-repeat-${id}`).checked;
    document.getElementById(`rem-opts-${id}`).style.display = isRepeat ? 'flex' : 'none';
}

// sets a reminder logic active
function activateReminder(id, fromButton = false)
{
    const msg = document.getElementById(`rem-msg-${id}`).value;
    const dateStr = document.getElementById(`rem-date-${id}`).value;
    const isRepeat = document.getElementById(`rem-repeat-${id}`).checked;
    
    if(!msg || !dateStr) return;

    const widgetBody = document.getElementById(`rem-form-${id}`).closest('.widget-body');

    // construct reminder object
    const reminderObj =
    {
        id: id,
        msg: msg,
        dateStr: dateStr,
        time: new Date(dateStr).getTime(), // timestamp for comparison
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

    // vpdate global list
    remindersList = remindersList.filter(r => r.id != id);
    remindersList.push(reminderObj);

    // update UI
    document.getElementById(`rem-form-${id}`).style.display = 'none';
    const statusDiv = document.getElementById(`rem-status-${id}`);
    statusDiv.innerText = `${translations[currentLang].rem_status_active} ${new Date(dateStr).toLocaleString()}`;
    
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth()); // show marker on calendar

    if(fromButton) saveWidgetContent(widgetBody);
}

// collects widget data and calls API to save
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

    // extract content based on type
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

    // debounce save request
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() =>
    {
        apiCall('save_widget', {widget_id: id, content: content, x: x, y: y});
    }, 500);
}

// deletes a widget from DOM and DB
async function deleteWidget(btn)
{
    const widget = btn.closest('.widget');
    if (isLogged && widget.dataset.id)
    {
        await apiCall('delete_widget', {widget_id: widget.dataset.id});
    }
    // clean up reminder list if applicable
    const uid = widget.querySelector('.widget-body').dataset.uid;
    remindersList = remindersList.filter(r => r.id != uid);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
    
    widget.remove();
}

// DRAG & DROP SYSTEM

let activeItem = null, activeOffsetX = 0, activeOffsetY = 0;

// mouse down: start dragging
document.addEventListener('mousedown', (e) =>
{
    // only drag if clicking header, but not the controls (x or _)
    if (e.target.closest('.widget-header') && !e.target.closest('.widget-controls'))
    {
        activeItem = e.target.closest('.widget');
        zIndexCounter++;
        activeItem.style.zIndex = zIndexCounter; // bring to front
        const rect = activeItem.getBoundingClientRect();
        activeOffsetX = e.clientX - rect.left;
        activeOffsetY = e.clientY - rect.top;
        activeItem.querySelector('.widget-header').style.cursor = 'grabbing';
    }
});

// mouse move: move widget
document.addEventListener('mousemove', (e) =>
{
    if (activeItem)
    {
        const container = activeItem.parentElement;
        const cRect = container.getBoundingClientRect();
        // calculate new position relative to container
        activeItem.style.left = `${e.clientX - cRect.left - activeOffsetX}px`;
        activeItem.style.top = `${e.clientY - cRect.top - activeOffsetY}px`;
    }
});

// mouse up: stop dragging and save position
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

// CALENDAR LOGIC

// navigates months (delta: -1 or +1)
function changeMonth(delta)
{
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

// renders the calendar grid
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

    // render day names headers
    daysLabels.forEach(dayName =>
    {
        const div = document.createElement('div');
        div.innerText = dayName;
        headerGrid.appendChild(div);
    });

    const date = new Date(year, month, 1);
    const monthName = date.toLocaleString(currentLang, {month: 'long'});
    monthYearLabel.innerText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

    // calculate padding for empty days at start of month
    let firstDayIndex = date.getDay(); 
    let adjustedIndex = (firstDayIndex === 0 ? 7 : firstDayIndex) - 1; // adjust for Monday start

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // render empty slots
    for (let i = 0; i < adjustedIndex; i++)
    {
        const div = document.createElement('div');
        div.classList.add('calendar-day', 'empty');
        grid.appendChild(div);
    }

    const today = new Date();
    // render actual days
    for (let i = 1; i <= daysInMonth; i++)
    {
        const div = document.createElement('div');
        div.classList.add('calendar-day');
        div.innerText = i;

        // highlight today
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear())
        {
            div.classList.add('today');
        }

        // check if day has a reminder
        const checkDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const hasReminder = remindersList.some(rem => rem.active && rem.dateStr && rem.dateStr.startsWith(checkDateStr));
        
        if (hasReminder)
        {
            div.classList.add('has-reminder'); // CSS class likely draws a dot
            div.title = "Reminder active";
        }

        grid.appendChild(div);
    }
}

// REMINDER CHECK LOOP

// called periodically to check if any reminder time is passed
function checkReminders()
{
    const now = Date.now();
    const t = translations[currentLang];
    let changed = false;

    remindersList.forEach(rem =>
    {
        if(rem.active && rem.time <= now)
        {
            // trigger alert
            alert(`${t.alert_prefix} ${rem.msg}`);
            
            // handle repetition logic
            if(rem.repeat)
            {
                let nextTime = new Date(rem.time);
                if(rem.unit === 'min') nextTime.setMinutes(nextTime.getMinutes() + rem.interval);
                if(rem.unit === 'hour') nextTime.setHours(nextTime.getHours() + rem.interval);
                if(rem.unit === 'day') nextTime.setDate(nextTime.getDate() + rem.interval);
                
                rem.time = nextTime.getTime();
                rem.dateStr = nextTime.toISOString().slice(0, 16); 
                
                // update UI text
                const statusDiv = document.getElementById(`rem-status-${rem.id}`);
                if(statusDiv) statusDiv.innerText = `${t.rem_status_active} ${nextTime.toLocaleString()}`;
            }
            else
            {
                // not repeating, mark as done
                rem.active = false;
                const statusDiv = document.getElementById(`rem-status-${rem.id}`);
                if(statusDiv) statusDiv.innerText = "Done";
            }
            changed = true;
            
            // save updated state to widget
            const el = document.querySelector(`[data-uid="${rem.id}"]`);
            if(el) saveWidgetContent(el);
        }
    });

    if(changed) renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
}

// CHARTING 

// opens stats chart modal
function openChartModal()
{
    if (!isLogged) return alert("Musisz być zalogowany, aby zobaczyć statystyki.");
    document.getElementById('chart-modal').style.display = 'flex';
    loadChartData(); 
}

// fetches historical data for chart
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

// renders chart using Chart.js
function renderChart(data, type, range)
{
    const ctx = document.getElementById('myChart').getContext('2d');
    
    const labels = data.map(item => item.label);
    const values = data.map(item => parseFloat(item.value).toFixed(1));

    // determine colors based on data type
    let color = '#7C68EE';
    let labelText = 'Wartość';
    
    if (type === 'water') {color = '#3498db'; labelText = 'Woda (ml)';}
    if (type === 'kcal') {color = '#e74c3c'; labelText = 'Kalorie';}
    if (type === 'steps') {color = '#2ecc71'; labelText = 'Kroki';}
    if (type === 'sleep') {color = '#9b59b6'; labelText = 'Sen (h)';}

    if (myChart)
    {
        myChart.destroy(); // destroy old chart instance before creating new one
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
