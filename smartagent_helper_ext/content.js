(() => {
  'use strict';

  const CONFIG = {
    MAX_QUESTIONS: 100,
    CLICK_DELAY_MS: 900,
    NEXT_DELAY_MS: 1800,
    DROPDOWN_WAIT_MS: 1200,
    LANGUAGE_SETTLE_MS: 1800,
    SUBMIT_CODE_DELAY_MS: 2400,
    RESULT_WAIT_MS: 15000, 
    EXTRACTION_RETRIES: 20,
    EXTRACTION_RETRY_MS: 500,
    ACE_WAIT_MS: 15000,
    FORCE_JAVA_FOR_CODE: true,
    REQUIRE_PASS_BEFORE_NEXT: false,
    DEBUG: true,
    AGENT_RETRIES: 3,
    MAX_CODE_FIX_ATTEMPTS: 2 // 1 initial try + 1 fix attempt
  };

  const engineState = { isRunning: false, completed: 0, targetCount: 0, mode: 'Auto' };
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const bridge = () => (typeof window !== 'undefined' ? window.SmartAgentHelper : null);

  function dbg(label, data = null) {
    if (!CONFIG.DEBUG) return;
    if (data !== null && data !== undefined) console.log(`[SMARTICA-EXT] ${label}`, data);
    else console.log(`[SMARTICA-EXT] ${label}`);
  }

  function safeStringify(obj) {
    try { return JSON.stringify(obj); } catch { return '[unserializable]'; }
  }

  function getLogSeverity(text) {
    const t = String(text || '').toLowerCase();
    if (t.includes('✅') || t.includes('success') || t.includes('solved') || t.includes('passed') || t.includes('✔️')) return 'success';
    if (t.includes('❌') || t.includes('error') || t.includes('failed') || t.includes('aborted') || t.includes('critical') || t.includes('manually switch')) return 'error';
    if (t.includes('⚠️') || t.includes('warning') || t.includes('fallback') || t.includes('halt') || t.includes('stop') || t.includes('fix') || t.includes('skipping')) return 'warning';
    return 'info';
  }

  // --- UI Panel Bridge ---
  function panelAddEvent(text, severity) {
    const b = bridge();
    if (b && typeof b.addEvent === 'function') {
      try { b.addEvent(text, severity || getLogSeverity(text)); } catch (_) {}
    }
  }

  function panelSetConnection(connected) {
    const b = bridge();
    if (b && typeof b.setConnectionState === 'function') {
      try { b.setConnectionState(!!connected, 'engine'); } catch (_) {}
    }
  }

  function panelSetEngine(running) {
    const b = bridge();
    if (b && typeof b.setEngineState === 'function') {
      if (engineState.isRunning !== running) {
          try { b.setEngineState(!!running, { completed: engineState.completed, targetCount: engineState.targetCount, mode: engineState.mode }); } catch (_) {}
      }
    }
  }

  function sendLog(text, data = null) {
    const logStr = data ? `${text} | ${safeStringify(data)}` : text;
    dbg(text, data);
    panelAddEvent(text, getLogSeverity(text));
    try { chrome.runtime.sendMessage({ type: 'ENGINE_LOG', text: logStr }, () => void chrome.runtime.lastError); } catch (_) {}
  }

  function broadcastState() {
    try {
      chrome.runtime.sendMessage({ type: 'ENGINE_STATE', isRunning: engineState.isRunning, completed: engineState.completed, targetCount: engineState.targetCount, mode: engineState.mode }, () => void chrome.runtime.lastError);
    } catch (_) {}

    const progressText = document.getElementById('progress-text');
    if (progressText) progressText.innerText = `${engineState.completed} / ${engineState.targetCount || '?'}`;

    panelSetEngine(engineState.isRunning);
  }

  // --- String Utils ---
  function clean(txt) { return String(txt || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
  function visible(el) { return !!el && el.offsetParent !== null; }
  function textOf(el) { return clean(el ? (el.innerText || el.textContent || '') : ''); }

  function normalizeText(str) {
    return String(str || '')
      .normalize('NFKC')
      .replace(/\u00a0/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/["'`“”‘’]/g, '')
      .replace(/[^\p{L}\p{N}\s:._\-()/,%?≤≥=+*\[\]^|]/gu, '')
      .trim();
  }

  function uniqueStrings(arr) { return [...new Set(arr.map(x => clean(x)).filter(Boolean))]; }

  // --- DOM Interaction Utils ---
  function safeClick(el, name = 'element') {
    if (!el || !visible(el)) { sendLog(`❌ Click failed: ${name} not visible or not found.`); return false; }
    try { 
      el.scrollIntoView({ block: 'center', behavior: 'smooth' }); 
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      el.click(); 
      sendLog(`🖱️ Clicked: ${name}`); 
      return true; 
    }
    catch (e) { sendLog(`❌ Exception clicking ${name}`, { error: e.message }); return false; }
  }

  async function waitFor(fn, timeoutMs = 10000, intervalMs = 300) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!engineState.isRunning) throw new Error('Stopped by user');
      try { const out = await fn(); if (out) return out; } catch (e) { dbg('waitFor swallowed error', e?.message || String(e)); }
      await sleep(intervalMs);
    }
    return null;
  }

  async function waitForMutationOrTimeout(timeoutMs = 1000) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; try { observer.disconnect(); } catch (_) {} resolve(true); };
      const observer = new MutationObserver(() => finish());
      try { observer.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true }); }
      catch (_) { resolve(true); return; }
      setTimeout(finish, timeoutMs);
    });
  }

  // --- Scrapers & Selectors ---
  function getQuestionRoot() {
    return document.querySelector('#answer-view') || 
           document.querySelector('main') || 
           document.querySelector('.question-container') || 
           document.querySelector('.layout-content') || 
           document.body;
  }

  function getProgrammingRoot() { return document.querySelector('programming-question') || getQuestionRoot(); }
  function getAceNode() { return document.querySelector('.ace_editor, [class*="ace_editor"]'); }
  function getAceTextarea() { return document.querySelector('.ace_text-input'); }
  function hasAceDom() { const node = getAceNode(); return !!(node && visible(node)); }
  function hasAceGlobal() { return typeof window.ace !== 'undefined'; }

  async function waitForAceDom() {
    sendLog('🔍 Waiting for Ace editor DOM...');
    return await waitFor(() => { const node = getAceNode(); return node && visible(node) ? node : null; }, CONFIG.ACE_WAIT_MS, 350);
  }

  function getAceEditor() {
    const host = getAceNode();
    if (!host || typeof window.ace === 'undefined') return null;
    try { return window.ace.edit(host); } catch (e) { dbg('getAceEditor failed', e?.message || String(e)); return null; }
  }

  function dispatchInputLike(el) {
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' })); } catch (_) {}
  }

  function setEditorCodeWithAceApi(code) {
    sendLog('💻 Purging editor and injecting via Ace API...');
    const ed = getAceEditor();
    if (!ed) return false;
    try { 
        // FIX: Explicitly clear the editor before pasting
        ed.setValue('', -1);
        ed.session.setValue('');
        ed.getSession().setValue(code); 
    }
    catch (_) {
      try { 
        ed.session.setValue(code); 
      }
      catch (_) {
        try { 
            ed.setValue(code, 1); 
            ed.clearSelection(); 
        }
        catch (e) { dbg('Ace setValue failed', e?.message || String(e)); return false; }
      }
    }
    try { ed.focus(); } catch (_) {}
    try { ed.navigateFileEnd(); } catch (_) {}
    try { ed.resize(true); } catch (_) {}
    sendLog('✅ Code injected via Ace API');
    return true;
  }

  function setEditorCodeWithTextareaFallback(code) {
    sendLog('💻 Purging editor and trying textarea fallback injection...');
    const textarea = getAceTextarea();
    if (!textarea) return false;
    try {
      textarea.focus();
      textarea.select(); 
      textarea.value = ''; // Force clear
      
      const success = document.execCommand('insertText', false, code);
      
      if (!success) {
          textarea.value = code;
          dispatchInputLike(textarea);
      }
      
      sendLog('✅ Code injected via textarea fallback');
      return true;
    } catch (e) { dbg('Textarea fallback failed', e?.message || String(e)); return false; }
  }

  function setEditorCode(code) { return (hasAceGlobal() && setEditorCodeWithAceApi(code)) || setEditorCodeWithTextareaFallback(code); }

  function getCurrentLanguage() {
    const angularDropdown = document.querySelector('app-language-dropdown .inner-text');
    if (angularDropdown) return textOf(angularDropdown);

    const fromDropdown = textOf(document.querySelector('.mydropdown .inner-text'));
    if (fromDropdown) return fromDropdown;

    const languageNode = [...document.querySelectorAll('div,span,label')].filter(visible).find(el => /your current selection is/i.test(textOf(el)));
    if (languageNode) {
      const txt = textOf(languageNode);
      const m = txt.match(/your current selection is\s*([a-z+#]+)/i);
      if (m) return m[1];
    }
    
    const codeTags = [...document.querySelectorAll('code[class*="language-"]')];
    if (codeTags.length > 0) return codeTags[0].className.replace('language-', '').trim();
    
    return '';
  }

  function getLanguageDropdown() {
    return (
      document.querySelector('app-language-dropdown .mydropdown') ||
      document.querySelector('.mydropdown') ||
      document.querySelector('select[class*="language"]') ||
      [...document.querySelectorAll('div,button,span')]
        .filter(visible)
        .find(el => /^(c|c\+\+|java|python|javascript)$/i.test(textOf(el)))
    );
  }

  async function selectLanguage(language = 'Java') {
    sendLog(`⚙️ Validating active language is set to: ${language}`);
    const wanted = normalizeText(language);
    const current = normalizeText(getCurrentLanguage());
    if (current === wanted) { sendLog(`✅ Language verified as ${language}`); return true; }
    
    const dropdown = getLanguageDropdown();
    if (!dropdown || !visible(dropdown)) { sendLog('⚠️ Language dropdown not found.'); return false; }
    
    if (dropdown.tagName.toLowerCase() === 'select') {
        const option = [...dropdown.options].find(opt => normalizeText(opt.innerText) === wanted || normalizeText(opt.value) === wanted);
        if (option) {
            dropdown.value = option.value;
            dispatchInputLike(dropdown);
            sendLog(`✅ Native select switched to ${language}`);
            return true;
        }
    }
    
    safeClick(dropdown, 'language dropdown');
    await sleep(CONFIG.DROPDOWN_WAIT_MS);
    
    const allCandidates = [...document.querySelectorAll('span, div, li, [role="option"], mat-option')].filter(visible);
    
    let option = allCandidates.find(el => normalizeText(textOf(el)) === wanted && !dropdown.contains(el) && el !== dropdown);

    if (!option) {
      option = [...document.querySelectorAll('label, li, button')]
        .filter(visible)
        .find(el => normalizeText(textOf(el)) === wanted);
    }
    
    if (!option) {
      option = allCandidates.find(el => normalizeText(textOf(el)).includes(wanted) && textOf(el).length < 20);
    }
    
    if (!option) {
      sendLog(`⚠️ Language option "${language}" not found anywhere in DOM.`);
      try { safeClick(document.body, 'body to close dropdown'); } catch (_) {}
      return false;
    }
    
    safeClick(option, `${language} option`);
    await sleep(CONFIG.LANGUAGE_SETTLE_MS);
    
    const after = normalizeText(getCurrentLanguage());
    if (after === wanted) { sendLog(`✅ Language verified as ${language}`); return true; }

    sendLog(`⚠️ Auto-select failed. UI still shows: "${getCurrentLanguage()}"`);
    return false;
  }

  function isCodingByText() {
    const rootText = normalizeText(textOf(getQuestionRoot()));
    return rootText.includes('coding question') || rootText.includes('submit code') || rootText.includes('problem statement') || rootText.includes('code constraints') || rootText.includes('provide custom input') || rootText.includes('fill your code here');
  }

  function isMcqByText() {
    const rootText = normalizeText(textOf(getQuestionRoot()));
    return rootText.includes('multi choice type question') || rootText.includes('single correct') || rootText.includes('select the most appropriate') || getOptions().length >= 2;
  }

  function getMcqQuestionText() {
    sendLog('📖 Extracting broad page context for MCQ...');
    const root = document.querySelector('[aria-labelledby="each-type-question"]') || 
                 document.querySelector('mcqsinglecorrect-question') || 
                 document.querySelector('#answer-view') || 
                 document.body;

    let fullText = root.innerText || root.textContent || "";
    fullText = fullText.replace(/\n{2,}/g, '\n\n').trim();

    if (!fullText || fullText.length < 2) {
        fullText = "[Question text hidden or image-based. Please infer the correct answer logically based solely on the relationship between the provided options.]";
    }

    return fullText;
  }

  function getOptionContainers() {
    const selectors = [
      '#answer-view [id^="tt-option-"]', 
      '[id^="tt-option-"]', 
      'mcqsinglecorrect-question label', 
      '#answer-view label', 
      '.question-cont label',
      '.option-container',
      'label.radio',
      'label.radio-inline',
      'input[type="radio"]' 
    ];
    let nodes = [];
    for (const sel of selectors) {
      const found = [...document.querySelectorAll(sel)].filter(visible);
      if (found.length) { 
        nodes = found.map(el => (el.tagName.toLowerCase() === 'input' ? (el.parentElement || el) : el));
        break; 
      }
    }
    return nodes;
  }

  function extractOptionText(el) {
    const txt = textOf(el);
    if (txt) return txt;
    const nested = [...el.querySelectorAll('span,div,p')].filter(visible).map(n => textOf(n)).filter(Boolean).join(' ').trim();
    return clean(nested);
  }

  function getOptions() {
    const nodes = getOptionContainers();
    const out = [];
    const seen = new Set();
    
    for (const node of nodes) {
      const container = node.closest('[id^="tt-option-"]') || node;
      const txt = extractOptionText(container);
      const n = normalizeText(txt);
      const id = container.id || `option-${out.length}`;
      
      if (!txt || n.length < 1) continue;
      if (['answer here', 'clear', 'skip', 'next', 'prev', 'submit code'].includes(n)) continue;
      
      const key = `${id}|${n}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      out.push({ index: out.length, id, el: container, text: txt, normalized: n });
    }
    return out;
  }

  function getCodingQuestionText() {
    sendLog('📖 Extracting coding question text...');
    const root = getProgrammingRoot();
    const nodes = [...root.querySelectorAll('[aria-labelledby="question-data"], [aria-labelledby="problem-statement"], [aria-labelledby="problem-statement-title"], [aria-labelledby="code-constraints-title"], [aria-labelledby="code-constraints"], [aria-labelledby="sample-testcases-title"], [aria-labelledby="each-tc-input-title"], [aria-labelledby="each-tc-input"], [aria-labelledby="each-tc-output-title"], [aria-labelledby="each-tc-output"], [aria-labelledby="notes-title"], p, pre, div, span')].filter(visible);
    
    const rawTexts = nodes.map(el => textOf(el)).filter(Boolean);
    const badPatterns = [/^fill your code here$/i,/^provide custom input$/i,/^your current selection is/i,/^gcc$/i,/^c$/i,/^c\+\+$/i,/^java$/i,/^python$/i,/^javascript$/i,/^submit code$/i,/^next$/i,/^prev$/i,/^clear$/i,/^skip$/i,/^\d+$/,/^[a-z]$/i];
    
    const cleaned = uniqueStrings(rawTexts)
      .filter(t => t.length > 1)
      .filter(t => !badPatterns.some(rx => rx.test(t)))
      .filter(t => !/^question no\s*:/i.test(t))
      .filter(t => !/^marks\s*:/i.test(t))
      .filter(t => !/^negative marks\s*:/i.test(t))
      .filter(t => !/^note\s*:?\s*$/i.test(t));
      
    const important = cleaned.filter(t => /problem statement|code constraints|sample test cases|input|output|example|examples|explanation|constraints|true|false/i.test(t) || t.length > 80);
    
    let finalText = important.join('\n\n').trim();
    finalText = finalText.replace(/fill your code here/gi, '').replace(/your current selection is gcc/gi, '').replace(/provide custom input/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    
    return finalText;
  }

  async function getQuestionWithRetry(type) {
    sendLog(`🔄 Extracting ${type} question with retries...`);
    for (let i = 0; i < CONFIG.EXTRACTION_RETRIES; i++) {
      if (!engineState.isRunning) throw new Error('Stopped by user');
      const q = type === 'coding' ? getCodingQuestionText() : getMcqQuestionText();
      
      if (q && q.length > 2) { 
        sendLog(`✅ Extracted ${type} question on attempt ${i + 1}`); 
        return q; 
      }
      await sleep(CONFIG.EXTRACTION_RETRY_MS);
    }
    sendLog(`❌ Failed to extract ${type} question after retries`, null, 'error');
    return '';
  }

  async function getStableFixture() {
    sendLog('🧪 Detecting question type...');
    for (let i = 0; i < 14; i++) {
      if (!engineState.isRunning) throw new Error('Stopped by user');
      
      const aceDom = hasAceDom();
      const optionsCount = getOptions().length;
      const mcqText = isMcqByText();
      const codingText = isCodingByText();

      if (optionsCount >= 2) return { type: 'mcq', hasAceDom: aceDom, hasAceGlobal: hasAceGlobal(), optionsCount, question: await getQuestionWithRetry('mcq') };
      if (aceDom) return { type: 'coding', hasAceDom: aceDom, hasAceGlobal: hasAceGlobal(), optionsCount, question: await getQuestionWithRetry('coding') };
      if (mcqText && !codingText) return { type: 'mcq', hasAceDom: aceDom, hasAceGlobal: hasAceGlobal(), optionsCount, question: await getQuestionWithRetry('mcq') };
      if (codingText && !mcqText) return { type: 'coding', hasAceDom: aceDom, hasAceGlobal: hasAceGlobal(), optionsCount, question: await getQuestionWithRetry('coding') };
      
      await sleep(350);
    }
    return { type: 'unknown', hasAceDom: hasAceDom(), hasAceGlobal: hasAceGlobal(), optionsCount: getOptions().length, question: '' };
  }

  function clickOptionByIndex(index) {
    sendLog(`🎯 Clicking option index ${index}`);
    const options = getOptions();
    if (index < 0 || index >= options.length) { sendLog(`❌ Option index out of bounds: ${index} / ${options.length}`); return false; }
    const opt = options[index];
    const target = opt.el.querySelector('input[type="radio"], input[type="checkbox"]') || opt.el.querySelector('label') || opt.el;
    return safeClick(target, `Option [${index}]`);
  }

  async function clickSubmitCodeButtonWithRetry() {
    sendLog('🎯 Hunting for Submit Code button...');
    for (let i = 0; i < 5; i++) {
      const btn = [...document.querySelectorAll('button, a, div.submit-btn, span')].filter(visible).find(btn => {
        const txt = btn.innerText.trim().toLowerCase();
        return txt === 'submit code' || txt === 'submit' || txt === 'run code';
      });

      if (btn) {
        sendLog('🖱️ Found Submit Code button, triggering click event...');
        const success = safeClick(btn, 'Submit Code');
        if (success) return true; // Fix: Guarantee it only clicks once and exits the loop immediately
      }
      
      await sleep(500); 
    }
    sendLog('❌ Failed to locate or click Submit Code button after multiple retries', null, 'error');
    return false;
  }

  function hasNextButton() {
    return !![...document.querySelectorAll('button, a, div, span')].filter(visible).find(el => normalizeText(textOf(el)) === 'next');
  }

  function clickNextButton() {
    const next = [...document.querySelectorAll('button, a, div, span')].filter(visible).find(el => normalizeText(textOf(el)) === 'next');
    if (!next) { sendLog('⚠️ Next button not found'); return false; }
    return safeClick(next, 'Next button');
  }

  function getPassSummary() {
    const nodes = [...document.querySelectorAll('td, div.test-result, span.status, div.tc-result, span.label-danger, span.label-success')].filter(el => el.offsetParent !== null);
    
    let passed = 0;
    let failed = 0;
    const passedElements = [];

    nodes.forEach(el => {
      const textMatch = el.innerText.trim().toLowerCase();
      
      if (['success', 'passed', 'correct', 'accepted'].includes(textMatch)) {
          passed++;
          passedElements.push(el);
      } else if (['failed', 'wrong answer', 'error', 'compilation error', 'time limit exceeded', 'runtime error'].includes(textMatch)) {
          failed++;
      }
    });

    return { passed, failed, total: passed + failed, passedElements };
  }

  function extractCompilerFeedback() {
    const errorNodes = [...document.querySelectorAll('.error-text, .compiler-error, pre.error, div.console-output, div.compile-error')].filter(visible);
    const text = errorNodes.map(n => textOf(n)).join('\n');
    return text ? text.slice(0, 1000) : ''; 
  }

  async function waitForPassSummary() {
    sendLog('⏳ Waiting for test case execution results...');
    
    const finalSummary = await waitFor(async () => {
      const tempSummary = getPassSummary();
      if (tempSummary.passed > 0 || tempSummary.failed > 0) {
          sendLog(`👀 Detected test results. Waiting 2s for all tests to populate...`);
          await sleep(2000);
          return getPassSummary();
      }
      return null;
    }, CONFIG.RESULT_WAIT_MS, 1500);

    const summary = finalSummary || getPassSummary(); 

    if (summary.total > 0) {
        sendLog(`📊 Execution Finished: ${summary.passed} Passed, ${summary.failed} Failed.`);
    }

    return summary;
  }

  // --- PARSERS ---

  function parseMcqAnswer(responseText, options) {
    sendLog('🧠 Parsing MCQ answer...');
    let index = null;
    let optionText = '';

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      const parsed = JSON.parse(jsonStr);

      if (parsed && typeof parsed.index === 'number') {
         index = parsed.index;
         optionText = parsed.optionText || '';
      }
    } catch(e) {
      sendLog('⚠️ JSON parse failed. Attempting regex scan...');
    }

    if (index === null) {
      const idxMatch = responseText.match(/"index"\s*:\s*(\d+)/i) || 
                       responseText.match(/(?:index|option|answer)\s*:?\s*(\d+)/i) || 
                       responseText.match(/\b(\d+)\b/);
      if (idxMatch) index = Number(idxMatch[1]);
    }

    if (index !== null && (index < 0 || index >= options.length)) {
       sendLog(`⚠️ Parsed index ${index} is out of bounds. Discarding.`);
       index = null;
    }

    if (index === null) { return null; }

    return { raw: responseText, index, optionText };
  }

  function parseCodingAnswer(responseText) {
    sendLog('🧠 Parsing coding answer...');
    let code = '';
    const startTag = '<<<START>>>';
    const endTag = '<<<END>>>';

    if (responseText.includes(startTag) && responseText.includes(endTag)) {
       code = responseText.split(startTag)[1].split(endTag)[0];
    } else {
       sendLog('⚠️ Delimiters missing. Attempting markdown fallback...');
       code = responseText.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '');
    }

    code = code.replace(/<<<START>>>/gi, '')
               .replace(/<<<END>>>/gi, '')
               .replace(/<<>>/g, '')
               .replace(/^<<\s*/, '')
               .replace(/\s*>>$/, '')
               .trim();

    if (!code || code.length < 5) return null;
    return { raw: responseText, code };
  }

  // --- LLM PROMPTS & COMMUNICATION ---
  function buildMcqPrompt(question, options) {
    return [
      'Answer this MCQ.',
      'Return your answer STRICTLY as a valid JSON object with two keys: "index" (number) and "optionText" (string).',
      'Example: {"index": 0, "optionText": "The correct answer text"}',
      '',
      `Question: ${question}`,
      ...options.map(opt => `${opt.index}: ${opt.text}`)
    ].join('\n');
  }

  function buildCodingPrompt(question, language) {
    return [
      `You are an expert ${language} programmer.`,
      `YOUR TASK: Solve the following coding question.`,
      `CRITICAL RULE: You MUST write the code in EXACTLY this language: ${language}.`,
      `DO NOT write in Java unless the requested language is explicitly Java. If you write in the wrong language, the system will crash.`,
      `Provide only the final, runnable code.`,
      `You MUST enclose your exact code between the exact delimiters <<<START>>> and <<<END>>>.`,
      `Do not use markdown blocks inside the delimiters.`,
      '',
      `Question: ${question}`
    ].join('\n');
  }

  function buildCodingFixPrompt(question, language, previousCode, errorFeedback) {
    let prompt = [
      `You are an expert ${language} programmer.`,
      `CRITICAL RULE: You MUST write the code in EXACTLY this language: ${language}.`,
      `DO NOT write in Java unless the requested language is explicitly Java. If you write in the wrong language, the system will crash.`,
      `CRITICAL ERROR: The previous code submitted FAILED the test cases. You must fix the logic or syntax errors.`,
      `Provide only the final, runnable code enclosed in <<<START>>> and <<<END>>>.`,
      '',
      `Question: ${question}`,
      '',
      `Previous Failed Code:`,
      previousCode
    ];

    if (errorFeedback && errorFeedback.length > 5) {
      prompt.push(``);
      prompt.push(`Compiler/Test Output (Errors):`);
      prompt.push(errorFeedback);
    }

    return prompt.join('\n');
  }

  async function askAgentBridge(promptStr) {
    sendLog('🌐 Sending strict-token prompt to AgentBridge...', { promptPreview: promptStr.slice(0, 120) });
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ command: 'ASK_AGENT', prompt: promptStr }, (response) => {
          if (chrome.runtime.lastError) { sendLog('❌ Extension messaging error', { error: chrome.runtime.lastError.message }); reject(new Error(chrome.runtime.lastError.message)); return; }
          const text = response?.payload?.text;
          if (response && response.ok && typeof text === 'string' && text.trim()) {
            sendLog('✅ AgentBridge response received');
            resolve(text);
          } else {
            const err = response && response.error;
            const errMsg = typeof err === 'string' ? err : (err?.message || safeStringify(err) || 'Unknown AgentBridge error / timeout');
            sendLog('❌ AgentBridge error', { error: errMsg });
            reject(new Error(errMsg));
          }
        });
      } catch (e) { sendLog('❌ Critical askAgentBridge exception', { error: e.message }); reject(e); }
    });
  }

  // --- SOLVER WORKFLOWS ---

  async function solveMcqQuestion(fixture) {
    sendLog('🛠️ Initiating MCQ solver routine...');
    const question = fixture.question || await getQuestionWithRetry('mcq');
    const options = getOptions();

    if (!question || options.length < 2) {
       sendLog(`⚠️ Failed to extract MCQ question completely. Skipping by random selection...`, null, 'warning');
       const randomIndex = Math.max(0, Math.floor(Math.random() * (options.length || 4)));
       if (options.length > 0) clickOptionByIndex(randomIndex);
       await sleep(CONFIG.CLICK_DELAY_MS);
       const moved = clickNextButton();
       return { type: 'mcq', clickedIndex: randomIndex, movedNext: moved, raw: 'SKIPPED_EXTRACTION_FAILURE' };
    }

    const prompt = buildMcqPrompt(question, options);
    let answer = null;

    for (let i = 0; i < CONFIG.AGENT_RETRIES; i++) {
      try {
        const rawResponse = await askAgentBridge(prompt);
        answer = parseMcqAnswer(rawResponse, options);
        if (answer && answer.index !== null) break;
      } catch (e) {
        sendLog(`⚠️ MCQ Fetch/Parse Error. Retrying (${i + 1}/${CONFIG.AGENT_RETRIES})...`);
        await sleep(1000);
      }
    }

    if (!answer || answer.index === null) {
      sendLog('⚠️ All parsing/network attempts failed. Selecting a RANDOM option as fallback.', null, 'warning');
      const randomIndex = Math.floor(Math.random() * options.length);
      answer = { index: randomIndex, raw: 'RANDOM_FALLBACK' };
    }

    if (!clickOptionByIndex(answer.index)) {
      sendLog(`⚠️ Failed to click option index=${answer.index}. Attempting to force next...`);
    } else {
      sendLog(`✅ Solved MCQ (clicked index ${answer.index})`);
    }
    
    await sleep(CONFIG.CLICK_DELAY_MS);
    const movedNext = clickNextButton();
    sendLog(movedNext ? '✅ Clicked Next button' : '⚠️ No Next button found');
    
    return { type: 'mcq', clickedIndex: answer.index, movedNext, raw: answer.raw };
  }

  async function solveCodingQuestion(fixture) {
    sendLog('🛠️ Initiating coding solver routine...');

    const aceNode = await waitForAceDom();
    if (!aceNode) sendLog(`⚠️ Ace DOM node not found after waiting. Trying to proceed anyway...`);

    const question = fixture.question || await getQuestionWithRetry('coding');
    
    if (!question || question.length < 20) {
      sendLog(`⚠️ Failed to extract coding question. Skipping to next...`, null, 'warning');
      const moved = clickNextButton();
      return { type: 'coding', language: 'Unknown', submitted: false, passedCount: 0, movedNext: moved, raw: 'SKIPPED_EXTRACTION_FAILURE' };
    }

    let targetLanguage = 'Java';
    
    // FIX: Interactive Language Enforcement
    if (CONFIG.FORCE_JAVA_FOR_CODE) {
      const ok = await selectLanguage('Java');
      if (!ok) {
         // Pause engine and prompt the user to manually switch instead of falling back to Python.
         sendLog(`❌ Please manually switch the editor to Java and click start again.`, null, 'error');
         stopEngine('Language requirement failed');
         throw new Error('Waiting for user to manually switch to Java.'); 
      }
    } else {
      targetLanguage = getCurrentLanguage() || 'Java';
    }

    let finalAnswer = null;
    let finalSummary = null;

    for (let solveAttempt = 1; solveAttempt <= CONFIG.MAX_CODE_FIX_ATTEMPTS; solveAttempt++) {
      sendLog(`🛠️ Coding Solve Request (Attempt ${solveAttempt}/${CONFIG.MAX_CODE_FIX_ATTEMPTS})...`);
      
      let compilerFeedback = extractCompilerFeedback();
      let prompt = (solveAttempt === 1) 
          ? buildCodingPrompt(question, targetLanguage) 
          : buildCodingFixPrompt(question, targetLanguage, finalAnswer ? finalAnswer.code : '', compilerFeedback);

      let answer = null;
      for (let i = 0; i < CONFIG.AGENT_RETRIES; i++) {
         try {
           const rawResponse = await askAgentBridge(prompt);
           answer = parseCodingAnswer(rawResponse);
           if (answer && answer.code) break;
         } catch (e) {
           sendLog(`⚠️ Coding Fetch Error. Retrying (${i + 1}/${CONFIG.AGENT_RETRIES})...`);
           await sleep(1500);
         }
      }

      if (!answer || !answer.code) {
          sendLog('❌ Could not parse valid code from AI. Skipping to next question...', null, 'error');
          break; 
      }

      finalAnswer = answer;

      if (!setEditorCode(answer.code)) {
        sendLog('⚠️ Failed to paste code into editor. Proceeding anyway...');
      } else {
        sendLog('✅ Pasted code successfully. Submitting code...');
      }
      
      await sleep(CONFIG.CLICK_DELAY_MS);
      
      const submitted = await clickSubmitCodeButtonWithRetry();
      if (!submitted) {
        sendLog('⚠️ Failed to click Submit Code. Skipping to next...');
        break;
      }
      
      finalSummary = await waitForPassSummary();
      const majorityFailed = finalSummary.total > 0 ? (finalSummary.failed > finalSummary.passed) : (finalSummary.passed === 0);

      if (majorityFailed) {
         if (solveAttempt < CONFIG.MAX_CODE_FIX_ATTEMPTS) {
            sendLog(`⚠️ Majority of tests failed (${finalSummary.passed} passed, ${finalSummary.failed} failed). Triggering Auto-Fix loop...`, null, 'warning');
            await sleep(2000); 
         } else {
            sendLog(`⚠️ Max fix attempts reached. Tests failed but proceeding to next question to avoid stalling.`, null, 'warning');
         }
      } else {
         sendLog(`✅ Code passed successfully (${finalSummary.passed} passed, ${finalSummary.failed} failed). Moving on!`, null, 'success');
         break; 
      }
    }
    
    const movedNext = CONFIG.REQUIRE_PASS_BEFORE_NEXT && finalSummary && finalSummary.passed === 0 ? false : clickNextButton();
    sendLog(movedNext ? '✅ Clicked Next button' : '⚠️ No Next button found');
    
    return { type: 'coding', language: targetLanguage, submitted: true, passedCount: finalSummary ? finalSummary.passed : 0, movedNext, raw: finalAnswer ? finalAnswer.raw : '' };
  }

  async function runOneQuestion() {
    sendLog('▶️ Detecting stable fixture...');
    const fixture = await getStableFixture();
    
    if (fixture.type === 'mcq') return await solveMcqQuestion(fixture);
    if (fixture.type === 'coding') return await solveCodingQuestion(fixture);
    
    sendLog('⚠️ Unknown question type. Skipping to prevent getting stuck...', null, 'warning');
    const moved = clickNextButton();
    return { type: 'unknown', movedNext: moved, raw: 'SKIPPED' };
  }

  async function runSingleMode() {
    if (engineState.isRunning) return;
    sendLog('🚀 Starting single question solver...');
    engineState.isRunning = true;
    engineState.completed = 0;
    engineState.targetCount = 1;
    panelSetConnection(true);
    broadcastState();
    
    try {
      const result = await runOneQuestion();
      engineState.completed++;
      broadcastState();
      sendLog(`✅ Single question completed. Advanced: ${result.movedNext}`);
    } catch (err) {
      if (err.message !== 'Waiting for user to manually switch to Java.') {
         sendLog(`❌ Error during single solve: ${err.message}`);
         dbg('runSingleMode error stack', err?.stack || 'no stack');
      }
    }
    
    sendLog('⏹ Single mode finished');
    engineState.isRunning = false;
    broadcastState();
  }

  async function runContinuousMode(maxCount) {
    if (engineState.isRunning) return;
    sendLog(`🚀 Starting auto-solver loop (target: ${maxCount})...`);
    engineState.isRunning = true;
    engineState.completed = 0;
    engineState.targetCount = maxCount;
    panelSetConnection(true);
    broadcastState();

    while (engineState.isRunning && engineState.completed < maxCount) {
      if (!hasNextButton() && engineState.completed > 0) { 
        sendLog("⏹ No 'Next' button detected. Assuming end of test.", null, 'warning'); 
        break; 
      }
      try {
        sendLog('========================================');
        sendLog(`▶️ Running question ${engineState.completed + 1} of ${maxCount}`);
        sendLog('========================================');
        const result = await runOneQuestion();
        engineState.completed++;
        broadcastState();
        
        if (!result.movedNext) { 
            sendLog('⚠️ Could not move to next question. Retrying next click...', null, 'warning'); 
            await sleep(2000);
            if (!clickNextButton()) {
                 sendLog('⏹ Next button permanently absent. Halting loop.', null, 'warning');
                 break;
            }
        }
        sendLog(`⏳ Waiting ${CONFIG.NEXT_DELAY_MS}ms for next question...`);
        await sleep(CONFIG.NEXT_DELAY_MS);
      } catch (err) {
        if (err.message === 'Waiting for user to manually switch to Java.') {
            break; // Stop loop cleanly because user intervention is required
        }
        sendLog(`⚠️ Critical error in loop: ${err.message}. Retrying in 5s...`, null, 'error');
        dbg('runContinuousMode error stack', err?.stack || 'no stack');
        await sleep(5000); 
        continue; 
      }
    }
    
    sendLog(`⏹ Loop finished. Total completed: ${engineState.completed}`);
    engineState.isRunning = false;
    broadcastState();
  }

  // --- ENGINE CONTROLS ---
  function stopEngine(reason = 'stopped') {
    if (!engineState.isRunning) return;
    engineState.isRunning = false;
    sendLog(`🛑 Engine ${reason} via UI.`, null, 'warning');
    broadcastState();
  }

  function setMode(modeName) {
    engineState.mode = modeName || 'Auto';
    broadcastState();
  }

  function hookIntoPanel() {
    const b = bridge();
    if (!b) return false;
    sendLog('🔗 Connecting engine to UI Panel...', null, 'info');
    panelSetConnection(true);

    b.startRun = () => {
      if (engineState.isRunning) return;
      const runCountInput = document.getElementById('run-count');
      const count = parseInt(runCountInput ? runCountInput.value : CONFIG.MAX_QUESTIONS, 10) || CONFIG.MAX_QUESTIONS;
      runContinuousMode(count);
    };

    b.stepRun = () => {
      if (!engineState.isRunning) runSingleMode();
      else sendLog('⚠️ Engine is already running in continuous mode.', null, 'warning');
    };

    b.stopRun = () => stopEngine('stopped');
    b.pauseRun = () => stopEngine('paused');

    b.toggleConnection = (connect) => {
      if (connect) {
        panelSetConnection(true);
        sendLog('📡 UI connection requested.', null, 'info');
        return true;
      }
      stopEngine('disconnected');
      panelSetConnection(false);
      return true;
    };

    b.setEngineState = (running) => {
      engineState.isRunning = !!running;
      broadcastState();
    };

    b.setConnectionState = (connected) => {
      panelSetConnection(!!connected);
    };

    b.setMode = (mode) => setMode(mode);
    b.isConnected = true;
    panelSetConnection(true);
    broadcastState();
    return true;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg?.command) return;
    if (msg.command === 'START_ENGINE') {
      const count = parseInt(msg.count, 10) || CONFIG.MAX_QUESTIONS;
      runContinuousMode(count);
      sendResponse({ started: true });
    } else if (msg.command === 'SOLVE_ONE') {
      runSingleMode();
      sendResponse({ started: true });
    } else if (msg.command === 'STOP_ENGINE') {
      stopEngine('stopped manually');
      sendResponse({ stopped: true });
    } else if (msg.command === 'GET_ENGINE_STATUS') {
      sendResponse({ isRunning: engineState.isRunning, completed: engineState.completed, targetCount: engineState.targetCount, mode: engineState.mode });
    } else if (msg.command === 'SMARTAGENT_UI_EVENT') {
      if (msg.eventType === 'REQUEST_CONNECT') panelSetConnection(true);
      if (msg.eventType === 'REQUEST_DISCONNECT') { stopEngine('disconnected'); panelSetConnection(false); }
      if (msg.eventType === 'MODE_CHANGED' && msg.mode) setMode(msg.mode);
      if (msg.eventType === 'ENGINE_STATE_CHANGED' && typeof msg.running === 'boolean') { engineState.isRunning = msg.running; broadcastState(); }
      sendResponse({ ok: true });
    }
    return true;
  });

  setTimeout(() => { if (!hookIntoPanel()) setTimeout(hookIntoPanel, 1500); }, 500);

  sendLog('✅ content.js backend engine loaded');
  dbg('Initial engine state', engineState);
})();