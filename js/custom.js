document.addEventListener('DOMContentLoaded', function() {
    loadParams();
    initSearchTips();
}, false);

window.addEventListener('popstate', () => {
    loadParams();
});

const form = document.getElementById('searchForm');
form.addEventListener('submit', (event) => {
    event.preventDefault();
    const searchBtn = document.getElementById("searchButton");
    if (searchBtn && (searchBtn.disabled || searchBtn.classList.contains("is-loading"))) {
        return;
    }
    ['since', 'until'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.autoPopulated === "true") {
            el.value = "";
            delete el.dataset.autoPopulated;
        }
    });
    updateClearDateButtons();
    if (!validateAccessToken()) {
        const tokenEl = document.getElementById("accessToken");
        if (tokenEl) tokenEl.reportValidity();
        return;
    }
    if (!validateLimit()) {
        const limitEl = document.getElementById("limit");
        if (limitEl) limitEl.reportValidity();
        return;
    }
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    if (!validateDateRange()) {
        const untilEl = document.getElementById("until");
        if (untilEl) untilEl.reportValidity();
        return;
    }
    if (!reportScoreValidity()) {
        return;
    }
    search(form);
});

const resetBtn = document.getElementById('resetButton');
if (resetBtn) {
    resetBtn.addEventListener('click', resetForm);
}

function validateAccessToken() {
    const tokenEl = document.getElementById("accessToken");
    if (!tokenEl) return true;
    parseAccessTokenInput();
    if (!tokenEl.value.trim()) {
        tokenEl.setCustomValidity("Please enter a valid Pushshift access token");
        return false;
    }
    tokenEl.setCustomValidity("");
    return true;
}

function validateLimit() {
    const limitEl = document.getElementById("limit");
    if (!limitEl) return true;
    const raw = limitEl.value.trim();
    if (raw === "") {
        limitEl.setCustomValidity("");
        return true;
    }
    const num = parseInt(raw, 10);
    if (isNaN(num) || String(num) !== raw || (limitEl.validity && (limitEl.validity.badInput || limitEl.validity.stepMismatch))) {
        limitEl.setCustomValidity("Please enter an integer between 1 and 1000");
        return false;
    }
    if (num < 1 || (limitEl.validity && limitEl.validity.rangeUnderflow)) {
        limitEl.setCustomValidity("Please select a value greater than 0");
        return false;
    }
    if (num > 1000 || (limitEl.validity && limitEl.validity.rangeOverflow)) {
        limitEl.setCustomValidity("Please select a value less than or equal to 1000");
        return false;
    }
    limitEl.setCustomValidity("");
    return true;
}

function validateScoreInput(el) {
    if (!el) return true;
    const raw = el.value.trim();
    if (raw === "") {
        el.setCustomValidity("");
        return true;
    }
    if (!/^-?\d+$/.test(raw) || (el.validity && (el.validity.badInput || el.validity.stepMismatch))) {
        el.setCustomValidity("Please enter an integer");
        return false;
    }
    el.setCustomValidity("");
    return true;
}

function validateScoreRange() {
    const minEl = document.getElementById("min_score");
    const maxEl = document.getElementById("max_score");
    if (!minEl || !maxEl) return true;

    const minValid = validateScoreInput(minEl);
    const maxValid = validateScoreInput(maxEl);

    if (!minValid || !maxValid) {
        return false;
    }

    if (minEl.value.trim() !== '' && maxEl.value.trim() !== '') {
        const minVal = parseInt(minEl.value.trim(), 10);
        const maxVal = parseInt(maxEl.value.trim(), 10);
        if (maxVal < minVal) {
            maxEl.setCustomValidity("Please enter a value greater than or equal to 'Min Score'");
            return false;
        }
    }
    maxEl.setCustomValidity("");
    return true;
}

function reportScoreValidity() {
    if (!validateScoreRange()) {
        const minEl = document.getElementById("min_score");
        const maxEl = document.getElementById("max_score");
        if (minEl && !minEl.checkValidity()) {
            minEl.reportValidity();
        } else if (maxEl) {
            maxEl.reportValidity();
        }
        return false;
    }
    return true;
}

function validateDateRange() {
    const sinceEl = document.getElementById("since");
    const untilEl = document.getElementById("until");
    if (!sinceEl || !untilEl) return true;

    if (sinceEl.value && untilEl.value) {
        const sinceTime = new Date(sinceEl.value).getTime();
        const untilTime = new Date(untilEl.value).getTime();
        if (!isNaN(sinceTime) && !isNaN(untilTime) && untilTime <= sinceTime) {
            untilEl.setCustomValidity("Please select a date later than the 'After' date");
            return false;
        }
    }
    untilEl.setCustomValidity("");
    return true;
}

function clearDate(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
    delete el.dataset.autoPopulated;
    validateDateRange();
    updateClearDateButtons();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateClearDateButtons() {
    ['since', 'until'].forEach(id => {
        const el = document.getElementById(id);
        const btn = document.getElementById(`clear-${id}`);
        if (el && btn) {
            const hasCommittedValue = Boolean(el.value) && el.dataset.autoPopulated !== "true";
            if (!hasCommittedValue) {
                btn.classList.add('is-hidden');
            } else if (document.activeElement !== el) {
                btn.classList.remove('is-hidden');
            }
        }
    });
}

function resetForm() {
    const form = document.getElementById('searchForm');
    if (!form) return;

    const resetFields = ['author', 'subreddit', 'limit', 'min_score', 'max_score', 'since', 'until', 'q'];
    resetFields.forEach(name => {
        const el = form.elements[name];
        if (el) {
            el.value = '';
            if (typeof el.setCustomValidity === 'function') {
                el.setCustomValidity('');
            }
        }
    });

    const kindEl = form.elements['kind'];
    if (kindEl && typeof kindEl.setCustomValidity === 'function') {
        kindEl.setCustomValidity('');
    }

    const tokenEl = form.elements['accessToken'];
    if (tokenEl && typeof tokenEl.setCustomValidity === 'function') {
        tokenEl.setCustomValidity('');
    }

    ['since', 'until'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.autoPopulated) {
            delete el.dataset.autoPopulated;
        }
    });

    updateKindUI();
    updateClearDateButtons();
    updateTypeMismatchNotice();

    currentSearchSessionId++;
    currentRequestNumber = 1;
    activeSearchConfig = null;
    accumulatedResults = [];
    revokeCurrentJsonBlob();
    latestCurlCommand = "";

    const searchBtn = document.getElementById("searchButton");
    if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.classList.remove("is-loading");
    }

    const resultsContainer = document.getElementById("results");
    if (resultsContainer) {
        resultsContainer.innerHTML = "";
    }
    const apiInfoContainer = document.getElementById("apiInfo");
    if (apiInfoContainer) {
        apiInfoContainer.innerHTML = "";
    }

    if (typeof window !== "undefined" && window.location && window.location.search) {
        history.pushState(Date.now(), "Reddit Search", window.location.pathname);
    }

    const resetBtn = document.getElementById("resetButton");
    if (resetBtn) {
        resetBtn.blur();
    }
}

function setupTipsPopup({ btnId, wrapperId, popupId, closeBtnId }) {
    const btn = document.getElementById(btnId);
    const wrapper = document.getElementById(wrapperId);
    const popup = document.getElementById(popupId);
    const closeBtn = document.getElementById(closeBtnId);
    if (!btn || !wrapper) return;

    const closeTips = (restoreFocus = false) => {
        wrapper.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        btn.blur();
        if (restoreFocus) {
            btn.focus();
        }
    };

    btn.addEventListener("click", (e) => {
        if (e && typeof e.stopPropagation === "function") {
            e.stopPropagation();
        }
        const isOpen = wrapper.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        if (isOpen && typeof document.querySelectorAll === "function") {
            document.querySelectorAll(".search-tips-wrapper.is-open").forEach(other => {
                if (other !== wrapper) {
                    other.classList.remove("is-open");
                    const otherBtn = (other && typeof other.querySelector === "function") ? other.querySelector(".search-tips-btn") : null;
                    if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                }
            });
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            if (e && typeof e.stopPropagation === "function") {
                e.stopPropagation();
            }
            closeTips(true);
        });
    }

    wrapper.addEventListener("mouseleave", () => {
        if (typeof window !== "undefined" && window.innerWidth > 768) {
            closeTips();
        }
    });

    document.addEventListener("click", (e) => {
        if (wrapper.classList.contains("is-open")) {
            if (popup && !popup.contains(e.target) && !btn.contains(e.target)) {
                closeTips();
            }
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && wrapper.classList.contains("is-open")) {
            closeTips(true);
        }
    });
}

function initSearchTips() {
    setupTipsPopup({
        btnId: "searchTipsBtn",
        wrapperId: "searchTipsWrapper",
        popupId: "searchTipsPopup",
        closeBtnId: "searchTipsCloseBtn"
    });
    setupTipsPopup({
        btnId: "tokenTipsBtn",
        wrapperId: "tokenTipsWrapper",
        popupId: "tokenTipsPopup",
        closeBtnId: "tokenTipsCloseBtn"
    });
}

function cleanRedditEntityList(input, prefix) {
    if (!input || typeof input !== "string") return "";
    const prefixRegex = new RegExp(`^(\\s*\\/)?${prefix}\\/`, 'i');
    return input
        .split(',')
        .map(t => t.trim().replace(prefixRegex, '').replace(/\/+$/, '').trim())
        .filter(Boolean)
        .join(",");
}

function cleanAuthorInput(input) {
    return cleanRedditEntityList(input, 'u');
}

function cleanSubredditInput(input) {
    return cleanRedditEntityList(input, 'r');
}

function parseRedditInput(input) {
    if (!input || typeof input !== "string") return null;
    let trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Check for explicit Reddit Thing Fullnames (single or multiple comma/space-separated)
    const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
    if (tokens.length > 0) {
        const hasPost = tokens.some(t => /^t3_[a-z0-9]+$/i.test(t));
        const hasComment = tokens.some(t => /^t1_[a-z0-9]+$/i.test(t));
        const allThings = tokens.every(t => /^(?:t1_|t3_)[a-z0-9]+$/i.test(t));

        if (allThings && hasPost && hasComment) {
            return { type: "mixed", format: "id" };
        }
        if (tokens.every(t => /^t3_[a-z0-9]+$/i.test(t))) {
            const clean = tokens.join(",");
            return { type: "submission", id: clean, cleanInput: clean, format: "id" };
        }
        if (tokens.every(t => /^t1_[a-z0-9]+$/i.test(t))) {
            const clean = tokens.join(",");
            return { type: "comment", id: clean, cleanInput: clean, format: "id" };
        }
    }

    // 2. Check for Reddit URLs
    const redditUrlRegex = /^(?:https?:\/\/)?(?:([a-z0-9-]+)\.)?(reddit\.com|redd\.it)(\/[^\s]*)?$/i;
    const urlMatch = trimmed.match(redditUrlRegex);
    if (urlMatch) {
        const subdomain = (urlMatch[1] || "").toLowerCase();
        const domain = urlMatch[2].toLowerCase();
        let pathname = urlMatch[3] || "/";
        pathname = pathname.split(/[?#]/)[0];
        const segments = pathname.split('/').filter(Boolean);

        if (domain === "redd.it") {
            if (subdomain !== "" && subdomain !== "www") {
                return null;
            }
            if (segments.length > 0 && /^[a-z0-9]+$/i.test(segments[0])) {
                const postId = segments[0];
                return { type: "submission", id: "t3_" + postId, cleanInput: "t3_" + postId, format: "link" };
            }
        } else if (domain === "reddit.com") {
            // Case 1: Post or Comment path with /comments/
            const commentsIdx = segments.indexOf("comments");
            if (commentsIdx !== -1 && segments.length > commentsIdx + 1 && /^[a-z0-9]+$/i.test(segments[commentsIdx + 1])) {
                const postId = segments[commentsIdx + 1];
                const afterPost = segments.slice(commentsIdx + 2);

                if (afterPost.length >= 2 && /^[a-z0-9]+$/i.test(afterPost[afterPost.length - 1])) {
                    const commentId = afterPost[afterPost.length - 1];
                    return { type: "comment", id: "t1_" + commentId, cleanInput: "t1_" + commentId, format: "link" };
                } else {
                    return { type: "submission", id: "t3_" + postId, cleanInput: "t3_" + postId, format: "link" };
                }
            }

            // Case 2: Gallery or Poll post paths: .../gallery/{postId} or .../poll/{postId}
            const galleryIdx = segments.indexOf("gallery");
            if (galleryIdx !== -1 && segments.length > galleryIdx + 1 && /^[a-z0-9]+$/i.test(segments[galleryIdx + 1])) {
                return { type: "submission", id: "t3_" + segments[galleryIdx + 1], cleanInput: "t3_" + segments[galleryIdx + 1], format: "link" };
            }

            // Case 3: Reddit app share links: .../s/{shareId}
            const sIdx = segments.indexOf("s");
            if (sIdx !== -1 && segments.length > sIdx + 1 && /^[a-z0-9]+$/i.test(segments[sIdx + 1])) {
                return { type: "share", id: segments[sIdx + 1], cleanInput: trimmed, format: "share_link" };
            }
        }
    }

    return null;
}

function updateTypeMismatchNotice() {
    const qEl = document.getElementById("q");
    const kindEl = document.getElementById("kind");
    const helpEl = document.getElementById("qMismatchHelp");
    const textEl = document.getElementById("qMismatchText");
    const linkEl = document.getElementById("qMismatchLink");
    if (!qEl || !kindEl || !helpEl || !textEl || !linkEl) return;

    const val = qEl.value.trim();
    const currentKind = kindEl.value;
    const parsed = parseRedditInput(val);

    if (parsed) {
        if (parsed.type === "share") {
            textEl.textContent = "Share link detected. Please use a direct Reddit link.";
            linkEl.textContent = "";
            linkEl.onclick = null;
            helpEl.classList.remove("is-hidden");
            return;
        }

        if (parsed.type === "mixed") {
            textEl.textContent = "Mixed post and comment IDs detected. Please search each type separately.";
            linkEl.textContent = "";
            linkEl.onclick = null;
            helpEl.classList.remove("is-hidden");
            return;
        }

        if (parsed.type !== currentKind) {
            const noun = parsed.format === "link" ? "link" : "thing ID";
            if (parsed.type === "submission") {
                textEl.textContent = `Reddit post ${noun} detected.`;
                linkEl.textContent = "Switch to Searching For Posts";
                linkEl.onclick = (e) => {
                    e.preventDefault();
                    kindEl.value = "submission";
                    updateKindUI();
                    updateTypeMismatchNotice();
                };
            } else {
                textEl.textContent = `Reddit comment ${noun} detected.`;
                linkEl.textContent = "Switch to Searching For Comments";
                linkEl.onclick = (e) => {
                    e.preventDefault();
                    kindEl.value = "comment";
                    updateKindUI();
                    updateTypeMismatchNotice();
                };
            }
            helpEl.classList.remove("is-hidden");
            return;
        }
    }

    helpEl.classList.add("is-hidden");
}

function loadParams() {
    form.reset();
    getAccessToken();
    getSettings();
    let hasKindParam = false;
    const urlParams = new URLSearchParams(window.location.search).entries();
    for (const param of urlParams) {
        try {
            let value;
            if (param[0] === "kind") {
                hasKindParam = true;
            }
            if (param[0] == "until" || param[0] == "since") {
                const num = Number(param[1]);
                if (!isNaN(num)) {
                    const date = new Date(num * 1000);
                    if (!isNaN(date.getTime())) {
                        const offset = date.getTimezoneOffset() * 60000;
                        value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
                    }
                }
            } else if (param[0] == "author") {
                value = cleanAuthorInput(param[1]);
            } else if (param[0] == "subreddit") {
                value = cleanSubredditInput(param[1]);
            } else {
                value = param[1];
            }
            const targetId = param[0] === "ids" ? "q" : param[0];
            const el = document.getElementById(targetId);
            if (el && value !== undefined) {
                if (el.type === "checkbox") {
                    el.checked = (value === "true" || value === "1");
                } else {
                    el.value = value;
                }
            }
        } catch(e) {
            console.log(e);
        }
    }
    const qEl = form.elements['q'];
    if (qEl && qEl.value.trim()) {
        const parsed = parseRedditInput(qEl.value.trim());
        if (parsed && !hasKindParam && (parsed.type === "submission" || parsed.type === "comment")) {
            form.elements['kind'].value = parsed.type;
        }
    }
    validateDateRange();
    validateScoreRange();
    updateClearDateButtons();
    updateKindUI();
    updateTypeMismatchNotice();
}

function getAccessToken() {
    try {
        const stored = localStorage.getItem("accessToken");
        if (stored) {
            document.getElementById("accessToken").value = stored.replace(/['"]+/g, "").trim();
        }
    } catch {}
}

let currentJsonBlobURL = null;

function revokeCurrentJsonBlob() {
    if (currentJsonBlobURL) {
        URL.revokeObjectURL(currentJsonBlobURL);
        currentJsonBlobURL = null;
    }
}

function clearAccessToken(userInitiated = false) {
    try {
        localStorage.removeItem("accessToken");
    } catch {}
    form.elements['accessToken'].value = "";
    if (userInitiated) {
        document.getElementById("apiInfo").innerHTML = "";
        revokeCurrentJsonBlob();
        const el = document.getElementById("accessToken");
        if (el) el.focus();
    }
}

const settingKeys = ["exactAuthorMatch", "renderMarkdown", "highlight", "showThumbnails"];

settingKeys.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener("change", () => {
            try {
                localStorage.setItem(id, el.checked);
            } catch {}
            if (id === "showThumbnails") {
                updateThumbnailsVisibility();
            } else if (id === "highlight") {
                updateHighlighting();
            } else if (id === "renderMarkdown") {
                updateMarkdownRendering();
            }
        });
    }
});

['since', 'until'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        const populateDefault = () => {
            if (!el.value) {
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                const localDate = new Date(now - offset).toISOString().slice(0, 10);
                el.value = `${localDate}T00:00`;
                el.dataset.autoPopulated = "true";
            }
        };

        el.addEventListener('pointerdown', populateDefault);

        el.addEventListener('keydown', (e) => {
            if (!el.value && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
                populateDefault();
            } else if (e.key !== 'Tab' && e.key !== 'Escape') {
                delete el.dataset.autoPopulated;
            }
        });

        el.addEventListener('input', () => {
            delete el.dataset.autoPopulated;
            validateDateRange();
            updateClearDateButtons();
        });

        el.addEventListener('change', () => {
            delete el.dataset.autoPopulated;
            validateDateRange();
            updateClearDateButtons();
        });

        el.addEventListener('blur', () => {
            if (el.dataset.autoPopulated === "true") {
                el.value = "";
                delete el.dataset.autoPopulated;
            }
            validateDateRange();
            updateClearDateButtons();
        });
    }
});

['min_score', 'max_score'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', validateScoreRange);
        el.addEventListener('change', validateScoreRange);
        el.addEventListener('invalid', validateScoreRange);
    }
});

const limitEl = document.getElementById('limit');
if (limitEl) {
    limitEl.addEventListener('input', () => {
        limitEl.setCustomValidity('');
        validateLimit();
    });
    limitEl.addEventListener('invalid', () => {
        validateLimit();
    });
}

const kindEl = document.getElementById('kind');
if (kindEl) {
    kindEl.addEventListener('change', () => {
        updateKindUI();
        updateTypeMismatchNotice();
    });
}

const queryInput = document.getElementById('q');
if (queryInput) {
    const handleQueryInput = () => {
        const val = queryInput.value.trim();
        const parsed = parseRedditInput(val);
        if (parsed && (parsed.type === "submission" || parsed.type === "comment")) {
            if (form.elements['kind'].value !== parsed.type) {
                form.elements['kind'].value = parsed.type;
                updateKindUI();
            }
        }
        updateTypeMismatchNotice();
    };
    queryInput.addEventListener('input', handleQueryInput);
    queryInput.addEventListener('paste', () => {
        setTimeout(handleQueryInput, 0);
    });
}

const tokenEl = document.getElementById('accessToken');
if (tokenEl) {
    tokenEl.addEventListener('focus', () => {
        tokenEl.type = 'text';
    });
    tokenEl.addEventListener('blur', () => {
        tokenEl.type = 'password';
    });
    tokenEl.addEventListener('input', () => {
        tokenEl.setCustomValidity('');
    });
    tokenEl.addEventListener('invalid', () => {
        tokenEl.setCustomValidity("Please enter a valid Pushshift access token");
    });

    const handleTokenParse = () => {
        const cleaned = parseAccessTokenInput();
        if (cleaned) {
            tokenEl.setCustomValidity('');
            try {
                localStorage.setItem("accessToken", cleaned);
            } catch {}
        } else {
            try {
                localStorage.removeItem("accessToken");
            } catch {}
        }
    };

    tokenEl.addEventListener('change', handleTokenParse);
}

function getSettings() {
    settingKeys.forEach(id => {
        try {
            const val = localStorage.getItem(id);
            if (val !== null) {
                const el = document.getElementById(id);
                if (el) {
                    el.checked = (val === "true");
                }
            }
        } catch {}
    });
    updateThumbnailsVisibility();
}

function updateKindUI() {
    const kindEl = document.getElementById("kind");
    const showThumbnailsField = document.getElementById("showThumbnailsField");
    const showThumbnailsEl = document.getElementById("showThumbnails");
    if (!kindEl || !showThumbnailsField) return;
    const isComment = (kindEl.value === "comment");
    if (isComment) {
        showThumbnailsField.classList.add("is-hidden-contextual");
    } else {
        showThumbnailsField.classList.remove("is-hidden-contextual");
    }
    if (showThumbnailsEl) {
        showThumbnailsEl.disabled = isComment;
        showThumbnailsEl.setAttribute("aria-hidden", isComment ? "true" : "false");
    }
}

function updateThumbnailsVisibility() {
    const resultsEl = document.getElementById("results");
    const showThumbnailsEl = document.getElementById("showThumbnails");
    if (!resultsEl || !showThumbnailsEl) return;
    if (showThumbnailsEl.checked) {
        resultsEl.classList.remove("hide-thumbnails");
    } else {
        resultsEl.classList.add("hide-thumbnails");
    }
}

function applySearchHighlighting(targetElements, term) {
    if (!term || targetElements.length === 0) return;
    if (typeof Mark === "undefined") return;
    let instance = new Mark(targetElements);
    if (!term.startsWith('"')) {
        let searchArray = term
            .split(/[\s,]+/)
            .filter(token => token && !token.startsWith('-') && token !== '|' && token !== '+')
            .map(token => token.replace(/^\+/, '').replace(/^["']+|["']+$/g, ''))
            .filter(Boolean);
        if (searchArray.length > 0) {
            instance.mark(searchArray, {
                "wildcards": "enabled",
                "accuracy": "complementary"
            });
        }
    } else {
        let cleanTerm = term.replaceAll('"', "").trim();
        if (cleanTerm) {
            instance.mark(cleanTerm, {
                "accuracy": "partially",
                "separateWordSearch": false
            });
        }
    }
}

function removeSearchHighlighting(targetElements) {
    if (targetElements.length === 0) return;
    if (typeof Mark === "undefined") return;
    let instance = new Mark(targetElements);
    instance.unmark();
}

function updateHighlighting() {
    const highlightEl = document.getElementById("highlight");
    const resultsContainer = document.getElementById("results");
    if (!highlightEl || !resultsContainer) return;

    const allCards = Array.from(resultsContainer.querySelectorAll(".card"));
    if (allCards.length === 0) return;

    if (activeSearchConfig) {
        activeSearchConfig.highlight = highlightEl.checked;
    }

    removeSearchHighlighting(allCards);
    if (highlightEl.checked) {
        const searchTerm = (activeSearchConfig ? activeSearchConfig.searchTerm : form.elements['q'].value).trim();
        applySearchHighlighting(allCards, searchTerm);
    }
}

function injectMediaExpanderButtons(cards) {
    const extensions = [".jpg", ".jpeg", ".png", ".gif", ".gifv", ".mp4"];
    const isRedditVideoComment = url => /(?:reddit\.com|redd\.it)\/(?:link\/[a-zA-Z0-9]+\/)?video\/[a-zA-Z0-9]+/i.test(url);
    for (const card of cards) {
        const links = card.querySelectorAll(".expand a");
        for (const link of links) {
            if (link.nextElementSibling == null || link.nextElementSibling.tagName != "BUTTON") {
                const url = link.href;
                const isGallery = (link.hasAttribute && link.hasAttribute("data-gallery")) || /(?:reddit\.com|redd\.it)\/gallery\/[a-zA-Z0-9]+/i.test(url);
                if (extensions.some(extension => url.includes(extension)) || url.includes("v.redd.it/") || isRedditVideoComment(url) || isGallery) {
                    const button = document.createElement("button");
                    button.type = "button";
                    button.classList.add("delete", "closed");
                    button.setAttribute("onclick", "directExpand(this)");
                    button.setAttribute("aria-label", isGallery ? "Expand gallery" : "Expand media");
                    button.setAttribute("title", isGallery ? "Expand gallery" : "Expand media");
                    link.after(button);
                }
            }
        }
    }
}

function updateMarkdownRendering() {
    const renderMarkdownEl = document.getElementById("renderMarkdown");
    const resultsContainer = document.getElementById("results");
    if (!renderMarkdownEl || !resultsContainer || accumulatedResults.length === 0) return;

    const renderMarkdown = renderMarkdownEl.checked;
    const allCards = Array.from(resultsContainer.querySelectorAll(".card"));
    if (allCards.length === 0) return;

    const objMap = new Map(accumulatedResults.map(item => [item.id, item]));

    for (const card of allCards) {
        const cardId = card.dataset.id || card.id;
        const obj = objMap.get(cardId);
        if (!obj) continue;

        const rawText = ("link_id" in obj) ? obj.body : obj.selftext;
        if (!rawText) continue;

        const markdownContainer = card.querySelector(".content.markdown");
        if (markdownContainer) {
            if (markdownContainer.querySelectorAll) {
                const videos = markdownContainer.querySelectorAll("video");
                videos.forEach(video => {
                    video.pause();
                    if (video.querySelectorAll) {
                        video.querySelectorAll("source").forEach(s => s.removeAttribute("src"));
                    }
                    video.removeAttribute("src");
                    video.load();
                });
            }
            markdownContainer.innerHTML = formatText(rawText, renderMarkdown);
        }
    }

    injectMediaExpanderButtons(allCards);
    updateHighlighting();
}

let latestCurlCommand = "";
let accumulatedResults = [];
let activeSearchConfig = null;
let currentSearchSessionId = 0;
let currentRequestNumber = 1;

async function copyCurl(btnElement, commandToCopy = null) {
    const textToCopy = commandToCopy || (btnElement && btnElement.dataset && btnElement.dataset.curl) || latestCurlCommand;
    if (!textToCopy) return;
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
        } else {
            const ta = document.createElement("textarea");
            ta.value = textToCopy;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        }
        if (btnElement) {
            btnElement.innerText = "Copied!";
            if (btnElement._copyTimeout) {
                clearTimeout(btnElement._copyTimeout);
            }
            btnElement._copyTimeout = setTimeout(() => {
                btnElement.innerText = "Copy cURL";
            }, 1500);
        }
    } catch (err) {
        console.error("Failed to copy cURL:", err);
    }
}

async function ensureMinLoadingTime(startTime, minDuration = 500) {
    const elapsed = Date.now() - startTime;
    if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }
}

async function search(form, until=-1, isRetry=false) {
    if (until < 0 && !isRetry) {
        currentSearchSessionId++;
    }
    const searchSessionId = currentSearchSessionId;
    
    if (until < 0) {    // New Search
        currentRequestNumber = 1;
        const searchBtn = document.getElementById("searchButton");
        if (searchBtn) {
            searchBtn.disabled = true;
            searchBtn.classList.add("is-loading");
        }
        document.getElementById("results").innerHTML = "";
        accumulatedResults = [];
        if (until == -1) {
            document.getElementById("apiInfo").innerHTML = "";
            revokeCurrentJsonBlob();
        }
    } else {            // Fetch More
        const fetchBtn = document.getElementById("fetch-" + until);
        if (fetchBtn) {
            fetchBtn.disabled = true;
            fetchBtn.classList.add("is-loading");
        }
    }

    let psURL;
    let path = "?";
    let currentLimit = 100;

    if (until >= 0 && activeSearchConfig) {
        psURL = activeSearchConfig.psBaseURL + "&until=" + until;
        currentLimit = activeSearchConfig.limit;
    } else {
        if (!validateLimit()) {
            const limitEl = document.getElementById("limit");
            if (limitEl) limitEl.reportValidity();
            return;
        }
        if (!validateDateRange()) {
            const untilEl = document.getElementById("until");
            if (untilEl) untilEl.reportValidity();
            return;
        }
        if (!reportScoreValidity()) {
            return;
        }

        let min_score, max_score, since, formUntil;
        const rawQuery = form.elements['q'].value.trim();
        const parsedObject = parseRedditInput(rawQuery);

        if (form.elements['kind'].value == "submission") {
            psURL = "https://api.pushshift.io/reddit/submission/search?html_decode=True";
            path += "kind=submission";
        } else {
            psURL = "https://api.pushshift.io/reddit/comment/search?html_decode=True";
            path += "kind=comment";
        }

        const authorEl = form.elements['author'];
        const cleanAuthor = cleanAuthorInput(authorEl.value);
        if (cleanAuthor !== '') {
            authorEl.value = cleanAuthor;
            const encodedAuthor = encodeURIComponent(cleanAuthor);
            psURL += "&author=" + encodedAuthor;
            path += "&author=" + encodedAuthor;
            if (form.elements['exactAuthorMatch'].checked) {
                psURL += "&exact_author=true";
                path += "&exactAuthorMatch=true";
            } else {
                path += "&exactAuthorMatch=false";
            }
        }

        const subredditEl = form.elements['subreddit'];
        const cleanSubreddit = cleanSubredditInput(subredditEl.value);
        if (cleanSubreddit !== '') {
            subredditEl.value = cleanSubreddit;
            const encodedSubreddit = encodeURIComponent(cleanSubreddit);
            psURL += "&subreddit=" + encodedSubreddit;
            path += "&subreddit=" + encodedSubreddit;
        }

        const rawMinScore = form.elements['min_score'].value.trim();
        if (rawMinScore !== '') {
            min_score = parseInt(rawMinScore, 10);
            psURL += "&min_score=" + min_score;
            path += "&min_score=" + min_score;
        }

        const rawMaxScore = form.elements['max_score'].value.trim();
        if (rawMaxScore !== '') {
            max_score = parseInt(rawMaxScore, 10);
            psURL += "&max_score=" + max_score;
            path += "&max_score=" + max_score;
        }

        if (form.elements['since'].value.trim() !== '') {
            const parsedSince = new Date(form.elements['since'].value).valueOf() / 1000;
            if (!isNaN(parsedSince)) {
                since = parsedSince;
                psURL += "&since=" + since;
                path += "&since=" + since;
            }
        }

        if (until >= 0) {
            psURL += "&until=" + until;
        } else if (form.elements['until'].value.trim() !== '') {
            const parsedFormUntil = new Date(form.elements['until'].value).valueOf() / 1000;
            if (!isNaN(parsedFormUntil)) {
                formUntil = parsedFormUntil;
            }
        }

        const queryVal = form.elements['q'].value.trim();
        const isObjectSearch = Boolean(parsedObject && parsedObject.type === form.elements['kind'].value);
        if (queryVal !== '') {
            if (isObjectSearch) {
                psURL += "&ids=" + encodeURIComponent(parsedObject.id);
                path += "&ids=" + encodeURIComponent(parsedObject.cleanInput);
            } else {
                const encodedQuery = encodeURIComponent(queryVal);
                psURL += "&q=" + encodedQuery;
                path += "&q=" + encodedQuery;
            }
        }

        const rawLimit = form.elements['limit'].value.trim();
        currentLimit = (rawLimit === '') ? 100 : parseInt(rawLimit, 10);
        psURL += "&limit=" + currentLimit;
        path += "&limit=" + currentLimit;

        if (until < 0) {
            activeSearchConfig = {
                psBaseURL: psURL,
                limit: currentLimit,
                searchTerm: isObjectSearch ? "" : queryVal,
                highlight: form.elements['highlight'].checked
            };
            if (formUntil !== undefined) {
                psURL += "&until=" + formUntil;
                path += "&until=" + formUntil;
            }
            if (until == -1) {
                history.pushState(Date.now(), "Reddit Search - Results", window.location.pathname + path);
            }
        }
    }
    let accessToken = parseAccessTokenInput();
    let exactAuthorMatch = form.elements['exactAuthorMatch'].checked;
    let renderMarkdown = form.elements['renderMarkdown'].checked;
    let highlight = form.elements['highlight'].checked;
    let showThumbnails = form.elements['showThumbnails'].checked;
    try {
        if (accessToken) {
            localStorage.setItem("accessToken", accessToken);
        } else {
            localStorage.removeItem("accessToken");
        }
        localStorage.setItem("exactAuthorMatch", exactAuthorMatch);
        localStorage.setItem("renderMarkdown", renderMarkdown);
        localStorage.setItem("highlight", highlight);
        localStorage.setItem("showThumbnails", showThumbnails);
    } catch {}

    const safeUrl = psURL.replaceAll("'", "%27");
    const safeToken = accessToken ? accessToken.replaceAll("'", "'\\''") : "";
    const currentRequestCurl = accessToken 
        ? `curl '${safeUrl}' \\\n  -H 'Authorization: Bearer ${safeToken}'`
        : `curl '${safeUrl}'`;
    latestCurlCommand = currentRequestCurl;

    const searchStartTime = Date.now();

    try {
        const json = await load(psURL, accessToken);
        if (searchSessionId !== currentSearchSessionId) {
            return;
        }
        await ensureMinLoadingTime(searchStartTime);
        if (searchSessionId !== currentSearchSessionId) {
            return;
        }

        if (!json || typeof json !== "object") {
            throw new Error("Invalid response from Pushshift API");
        }

        if ("detail" in json) {
            let detail = json.detail;
            if (typeof detail === "string") {
                try {
                    const parsed = JSON.parse(detail);
                    if (parsed && parsed.detail) {
                        detail = parsed.detail;
                    }
                } catch {}
            } else if (Array.isArray(detail)) {
                detail = detail.map(d => (d && d.msg) ? d.msg : JSON.stringify(d)).join(", ");
            }
            console.log(detail);

            const detailLower = (typeof detail === "string") ? detail.toLowerCase() : "";

            if (detailLower.includes("token") && detailLower.includes("revoked")) {
                trackEvent('token-revoked');
                clearAccessToken();
                document.getElementById("apiInfo").innerHTML = `
                    Revoked Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                    title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                `;
            } else if (detailLower.includes("token") && detailLower.includes("expired")) {
                if (isRetry) {
                    trackEvent('refresh-fail');
                    clearAccessToken();
                    document.getElementById("apiInfo").innerHTML = `
                        Error Refreshing Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                        title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                    `;
                    return;
                }
                document.getElementById("apiInfo").innerHTML = "Refreshing Token...";
                const token = await refreshToken(accessToken);
                if (token == null) {
                    trackEvent('refresh-fail');
                    clearAccessToken();
                    document.getElementById("apiInfo").innerHTML = `
                        Error Refreshing Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                        title="Request new access token from Pushshift" class="has-text-danger">Request New Token</a>
                    `;
                    return;
                } else {
                    trackEvent('refresh-success');
                    document.getElementById("accessToken").value = token;
                    try {
                        localStorage.setItem("accessToken", token);
                    } catch {}
                    const retryUntil = (until == -1) ? -2 : until;
                    await search(form, retryUntil, true);
                    return;
                }
            } else if ((detailLower.includes("token") && (detailLower.includes("invalid") || detailLower.includes("malformed"))) || detailLower.includes("not authenticated")) {
                trackEvent('token-invalid');
                clearAccessToken();
                document.getElementById("apiInfo").innerHTML = `
                    Invalid Token - <a href="https://auth.pushshift.io/authorize" target="_blank" rel="noopener noreferrer"
                    title="Request access token from Pushshift" class="has-text-danger">Request Token</a>
                `;
            } else {
                trackEvent('error-request');
                revokeCurrentJsonBlob();
                const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
                currentJsonBlobURL = URL.createObjectURL(blob);

                const errorMsg = (typeof detail === "string" && detail.length > 0) ? detail : "Pushshift May Be Down";
                document.getElementById("apiInfo").innerHTML = `
                    <div>
                        <span class="has-text-grey-lighter has-text-weight-semibold">Search Error: ${escapeHTML(errorMsg)}</span>
                    </div>
                    <div class="is-size-7 mt-1">
                        <a href="${currentJsonBlobURL}" target="_blank" rel="noopener noreferrer" title="View raw JSON response" class="has-text-grey-light">View JSON</a>
                        <span class="has-text-grey mx-1">·</span>
                        <a href="#" onclick="event.preventDefault(); copyCurl(this);" title="Copy cURL command to clipboard" class="has-text-grey-light">Copy cURL</a>
                    </div>
                `;
            }
            return;
        }

        if (!Array.isArray(json.data)) {
            throw new Error("Missing data array in response");
        }

        const oldFetchButton = document.getElementById("fetch-" + until);
        if (oldFetchButton) {
            oldFetchButton.remove();
        }

        const seenIds = new Set(accumulatedResults.map(item => item && item.id).filter(Boolean));
        const uniqueData = [];
        for (const item of json.data) {
            if (!item || !item.id) {
                uniqueData.push(item);
            } else if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                uniqueData.push(item);
            }
        }

        const rawNextUntil = (json.data.length > 0 && json.data[json.data.length - 1].created_utc != null)
            ? json.data[json.data.length - 1].created_utc
            : null;

        const esHits = json.metadata?.es?.hits?.total;
        const esTotal = (typeof esHits === "number") ? esHits : esHits?.value;
        const esRelation = esHits?.relation;

        let hasMore = false;
        if (uniqueData.length > 0 && json.data.length > 0) {
            if (typeof esTotal === "number") {
                if (esRelation === "gte") {
                    // Capped total hits (e.g. 10,000+). There are guaranteed to be more hits remaining.
                    hasMore = true;
                } else if (esRelation === "eq" || !esRelation) {
                    // Exact total hits for this request window. If esTotal > currentLimit, more hits exist in ES.
                    hasMore = esTotal > currentLimit;
                }
            } else if (json.data.length >= currentLimit) {
                hasMore = true;
            } else {
                // Metadata missing: Pushshift backend post-processing (cross-shard deduplication,
                // quarantined/banned subreddits, DMCA takedowns) often filters 1-5 posts from a full batch.
                // Allow a tolerance threshold so batches of 95-99 on a limit of 100 still offer pagination.
                const filterTolerance = Math.min(5, Math.ceil(currentLimit * 0.05));
                hasMore = (currentLimit - json.data.length) <= filterTolerance;
            }
        }
        const isEnd = !hasMore && ((accumulatedResults.length + uniqueData.length) > 0);

        accumulatedResults = accumulatedResults.concat(uniqueData);
        const result_count = accumulatedResults.length;

        revokeCurrentJsonBlob();
        const accumulatedJson = { ...json, data: accumulatedResults };
        const blob = new Blob([JSON.stringify(accumulatedJson, null, 2)], { type: "application/json" });
        currentJsonBlobURL = URL.createObjectURL(blob);

        const resultsContainer = document.getElementById("results");
        const prevCardCount = resultsContainer.querySelectorAll(".card").length;

        const renderMarkdown = form.elements['renderMarkdown'].checked;
        const showThumbnails = form.elements['showThumbnails'].checked;

        let dividerHtml = "";
        if (until < 0) {
            dividerHtml = `
                <div class="batch-divider is-borderless my-3" id="initialBatchDivider">
                    <span class="batch-divider-label">
                        <span class="batch-divider-left">
                            <span class="batch-divider-prefix is-hidden">Request 1</span>
                            <a href="${currentJsonBlobURL}" target="_blank" rel="noopener noreferrer" title="View raw JSON response" class="has-text-grey-light batch-divider-json is-size-7" id="initialViewJson">View JSON</a>
                        </span>
                        <span class="batch-divider-dot">·</span>
                        <span class="batch-divider-right">
                            <a href="#" class="batch-divider-curl has-text-grey-light is-size-7" onclick="event.preventDefault(); copyCurl(this);" data-curl="${escapeHTML(currentRequestCurl)}" title="Copy cURL command for this request">Copy cURL</a>
                        </span>
                    </span>
                </div>
            `;
        } else if (until >= 0 && uniqueData.length > 0) {
            const initialDivider = document.getElementById("initialBatchDivider");
            if (initialDivider) {
                initialDivider.classList.remove("is-borderless");
                const prefix = initialDivider.querySelector(".batch-divider-prefix");
                if (prefix) prefix.classList.remove("is-hidden");
                const viewJson = document.getElementById("initialViewJson");
                if (viewJson) viewJson.remove();
            }
            currentRequestNumber++;
            dividerHtml = `
                <div class="batch-divider my-4">
                    <span class="batch-divider-label">
                        <span class="batch-divider-left">Request ${currentRequestNumber}</span>
                        <span class="batch-divider-dot">·</span>
                        <span class="batch-divider-right">
                            <a href="#" class="batch-divider-curl has-text-grey-light is-size-7" onclick="event.preventDefault(); copyCurl(this);" data-curl="${escapeHTML(currentRequestCurl)}" title="Copy cURL command for this request">Copy cURL</a>
                        </span>
                    </span>
                </div>
            `;
        }

        const html = dividerHtml + generateHTML(uniqueData, renderMarkdown, showThumbnails, hasMore, rawNextUntil, isEnd);
        resultsContainer.insertAdjacentHTML("beforeend", html);
        updateThumbnailsVisibility();

        const newCards = Array.from(resultsContainer.querySelectorAll(".card")).slice(prevCardCount);

        // Highlight search terms
        const searchTerm = (activeSearchConfig ? activeSearchConfig.searchTerm : form.elements['q'].value).trim();
        const highlightSetting = activeSearchConfig ? activeSearchConfig.highlight : form.elements['highlight'].checked;
        if (highlightSetting && searchTerm.length > 0 && newCards.length > 0) {
            applySearchHighlighting(newCards, searchTerm);
        }

        if (until < 0) {
            const redactedNotice = (result_count === 0 && typeof esTotal === "number" && esTotal > 0)
                ? " - These results have been redacted by Pushshift"
                : "";
            document.getElementById("apiInfo").innerHTML = `
                <div class="has-text-weight-bold has-text-white">
                    ${until == -2 ? "<span class='has-text-weight-normal mr-1'>Token Refreshed -</span>" : ""}
                    <span id="result_count">${result_count}</span> Result${result_count == 1 ? "" : "s"}${redactedNotice}
                </div>
            `;
        } else {
            document.getElementById("apiInfo").innerHTML = `
                <div class="api-status-row has-text-weight-bold has-text-white">
                    <span class="api-status-left"><span id="result_count">${result_count}</span> Result${result_count == 1 ? "" : "s"}</span>
                    <span class="api-status-dot">·</span>
                    <span class="api-status-right"><a href="${currentJsonBlobURL}" target="_blank" rel="noopener noreferrer" title="View raw JSON response" class="has-text-white">View JSON</a></span>
                </div>
            `;
        }

        // Inject buttons for expanding linked media
        injectMediaExpanderButtons(newCards);

    } catch (e) {
        await ensureMinLoadingTime(searchStartTime);
        console.log(e);
        trackEvent('error-response');
        document.getElementById("apiInfo").innerHTML = `
            <div>
                <span class="has-text-grey-lighter has-text-weight-semibold">Search Error: Pushshift May Be Down</span>
            </div>
            <div class="is-size-7 mt-1">
                <a href="#" onclick="event.preventDefault(); copyCurl(this);" title="Copy cURL command to clipboard" class="has-text-grey-light">Copy cURL</a>
            </div>
        `;
    } finally {
        await ensureMinLoadingTime(searchStartTime);
        if (searchSessionId === currentSearchSessionId) {
            const searchBtn = document.getElementById("searchButton");
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.classList.remove("is-loading");
            }
            if (until >= 0) {
                const fetchBtn = document.getElementById("fetch-" + until);
                if (fetchBtn) {
                    fetchBtn.disabled = false;
                    fetchBtn.classList.remove("is-loading");
                }
            }
        }
    }
}

function fetchMore(until) {
    const btn = document.getElementById("fetch-" + until);
    if (btn) {
        if (btn.disabled || btn.classList.contains("is-loading")) {
            return;
        }
        btn.disabled = true;
        btn.classList.add("is-loading");
    }
    search(form, until);
}

function generateHTML(data, renderMarkdown, showThumbnails, hasMore = true, nextUntil = null, isEnd = false) {
    let count = 0;
    let html = "";
    let until = (nextUntil != null)
        ? nextUntil
        : (data.length > 0 && data[data.length - 1] && data[data.length - 1].created_utc != null)
            ? data[data.length - 1].created_utc
            : 2147483647;
    
    data.forEach(obj => {
        count += 1;
        
        let timestamp = "";
        let utcTimestamp = "";
        if (obj.created_utc) {
            const date = new Date(obj.created_utc * 1000);
            if (!isNaN(date.getTime())) {
                timestamp = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                utcTimestamp = date.toISOString().replace(".000Z", "Z");
            }
        }

        const subreddit = escapeHTML(obj.subreddit || "");
        const rawAuthor = obj.author || "[deleted]";
        const author = escapeHTML(rawAuthor);
        const lowerAuthor = author.toLowerCase();
        const isAuthorDeleted = lowerAuthor === "[deleted]" || lowerAuthor === "[removed]";
        let authorHtml;
        if (isAuthorDeleted) {
            const authorTitle = lowerAuthor === "[removed]" ? "Removed by moderator or Reddit" : "Deleted by user";
            authorHtml = `<span class="has-text-grey ml-1" title="${authorTitle}">${author}</span>`;
        } else {
            authorHtml = `<a href="https://reddit.com/user/${author}" target="_blank" rel="noopener noreferrer" title="View user on Reddit" class="has-text-danger ml-1">u/${author}</a>`;
        }

        const permalink = obj.permalink ? encodeURI(obj.permalink) : "";
        let redditUrl;
        if ("link_id" in obj) {
            const cleanLinkId = obj.link_id ? String(obj.link_id).replace("t3_", "") : "";
            redditUrl = obj.permalink
                ? "https://reddit.com" + permalink
                : (cleanLinkId
                    ? `https://reddit.com/comments/${encodeURIComponent(cleanLinkId)}/-/${encodeURIComponent(obj.id)}`
                    : `https://reddit.com/comments/${encodeURIComponent(obj.id)}`);
        } else {
            redditUrl = obj.permalink
                ? "https://reddit.com" + permalink
                : `https://reddit.com/comments/${encodeURIComponent(obj.id)}`;
        }

        const scoreText = obj.score != null ? obj.score.toLocaleString() : "0";
        const isNsfw = Boolean(obj.over_18);
        const nsfwBadge = isNsfw ? `<span class="tag is-danger has-text-weight-bold nsfw-badge ml-2 mb-0" title="Not Safe For Work">NSFW</span>` : "";

        let statsHtml = `<span class="score">Score: ${scoreText}</span>`;
        if (timestamp) {
            statsHtml = `<span class="score mr-1">Score: ${scoreText}</span> · <span class="timestamp ml-1"><span class="local-time">${timestamp}</span><span class="utc-time">${utcTimestamp}</span></span>`;
        }

        html += `
            <div class="card has-text-grey-light my-4" id="${escapeHTML(obj.id)}" data-id="${escapeHTML(obj.id)}">
                <div class="card-content">
                    <div class="content mb-3">
                        <nav class="level">
                            <div class="level-left">
                                <div class="level-item is-block-mobile">
                                    <a href="https://reddit.com/r/${subreddit}" target="_blank" rel="noopener noreferrer" title="View subreddit on Reddit" class="has-text-danger mr-1">r/${subreddit}</a>
                                    ·
                                    ${authorHtml}${nsfwBadge}
                                </div>
                            </div>
                            <div class="level-right">
                                <div class="level-item is-block-mobile">
                                    <p class="is-size-7">
                                        ${statsHtml}
                                    </p>
                                </div>
                            </div>
                        </nav>
                    </div>
        `;

        if ("link_id" in obj) {  // Comment
            html += `
                    <div class="content mb-3 markdown expand wrap">
                        ${formatText(obj.body, renderMarkdown)}
                    </div>
            `;
        } else {  // Post
            const formattedSelftext = formatText(obj.selftext, renderMarkdown);
            let linkHtml = "";

            if (!obj.is_self) {  // Link Post
                const rawUrl = (typeof obj.url === "string") ? obj.url.trim() : "";
                const isSafeUrl = /^(?:https?:\/\/|\/)/i.test(rawUrl);
                const safeHref = isSafeUrl ? escapeHTML(rawUrl) : "#";
                const displayUrl = escapeHTML(rawUrl);

                let galleryAttr = "";
                if ((obj.is_gallery || rawUrl.includes("/gallery/")) && obj.media_metadata) {
                    const items = (obj.gallery_data && Array.isArray(obj.gallery_data.items))
                        ? obj.gallery_data.items
                        : Object.keys(obj.media_metadata).map(id => ({ media_id: id }));

                    const galleryItems = [];
                    for (const item of items) {
                        const meta = obj.media_metadata[item.media_id];
                        if (!meta || meta.status !== "valid") continue;
                        let src = "";
                        if (meta.s && meta.s.u) {
                            src = meta.s.u.split("?")[0].replace("preview.redd.it", "i.redd.it");
                        } else if (meta.m) {
                            const ext = meta.m.includes("png") ? "png" : meta.m.includes("gif") ? "gif" : "jpg";
                            src = `https://i.redd.it/${item.media_id}.${ext}`;
                        }
                        if (src) {
                            galleryItems.push({
                                src: src,
                                caption: item.caption || ""
                            });
                        }
                    }
                    if (galleryItems.length > 0) {
                        galleryAttr = ` data-gallery="${escapeHTML(JSON.stringify(galleryItems))}"`;
                    }
                }

                const linkMargin = formattedSelftext ? "mb-2" : "mb-3";
                linkHtml = `
                    <p class="expand wrap ${linkMargin}">
                        <a href="${safeHref}" target="_blank" rel="noopener noreferrer" title="View linked URL" class="has-text-danger"${galleryAttr}>${displayUrl}</a>
                    </p>
                `;
            }

            const mediaMargin = !formattedSelftext ? "mb-3" : "mb-2";

            html += `
                    <div class="media ${mediaMargin}">
            `;

            if ("thumbnail" in obj && typeof obj.thumbnail === "string" && obj.thumbnail.startsWith("http")) {
                const thumbUrl = escapeHTML(obj.thumbnail.replace(/&amp;/g, "&"));
                html += `
                        <div class="media-left">
                            <figure class="image is-96x96">
                                <a href="${redditUrl}" target="_blank" rel="noopener noreferrer" title="View on Reddit">
                                    <img src="${thumbUrl}" alt="Thumbnail" loading="lazy" onerror="hideThumbnail(this)">
                                </a>
                            </figure>
                        </div>
                `;
            }

            html += `
                        <div class="media-content">
                            <p class="post-title">
                                <a href="${redditUrl}" target="_blank" rel="noopener noreferrer" class="has-text-light has-text-weight-bold">${escapeHTML(obj.title)}</a>
                            </p>
                        </div>
                    </div>
                    ${linkHtml}
                    ${formattedSelftext ? `<div class="content mb-3 markdown expand wrap">${formattedSelftext}</div>` : ""}
            `;
        }

        html += `
                    <div class="card-footer-action is-size-7 mt-3">
                        <a href="${redditUrl}" target="_blank" rel="noopener noreferrer" class="has-text-grey-light">View on Reddit</a>
                    </div>
                </div>
            </div>
        `;

    });

    if (hasMore && count > 0 && until != null && until < 2147483647) {
        html += `
            <button type="button" class="button is-danger is-fullwidth my-5" 
            id="fetch-${until}" data-umami-event="more-button" onclick="fetchMore(${until})">Fetch More</button>
        `;
    } else if (isEnd) {
        html += `
            <p class="has-text-centered has-text-grey my-5 is-size-7" id="endOfResults">End of Results</p>
        `;
    }

    return html;
}

function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const renderer = SnuOwnd.getRedditRenderer();
renderer.context.link_attributes = function(e, n, t) {
    e.s += ' target="_blank" rel="noopener noreferrer"';
};
const markdownParser = SnuOwnd.getParser(renderer, SnuOwnd.getParser().extensions | SnuOwnd.MKDEXT_FENCED_CODE);

function formatText(text, use_markdown) {
    if (!text) return "";
    if (use_markdown) {
        text = text.replace(/&amp;/g, "&");
        text = text.replace(/(^|\n)&gt; ?/g, "$1> ");
        text = markdownParser.render(text);

        // Link native Giphy embeds
        text = text.replace(/!\[gif\]\(giphy\|(\w+)[\|\w]*\)/g, (match, id) =>
            `<a href="https://media.giphy.com/media/${id}/giphy.gif" target="_blank" rel="noopener noreferrer">${match}</a>`
        );

        return text;
    } else {
        return escapeHTML(text).replaceAll("\n", "<br>");
    }
}

async function load(url, accessToken) {
    let headers = { headers: { "Authorization": `Bearer ${accessToken}` } };
    let response = await fetch(url, headers);
    return await response.json();
}

async function refreshToken(accessToken) {
    if (!accessToken || typeof accessToken !== "string") return null;
    const cleanToken = accessToken.replace(/['"]+/g, "").trim();
    const url = "https://auth.pushshift.io/refresh?access_token=" + encodeURIComponent(cleanToken);
    let newToken = null;
    try {
        const response = await fetch(url, { method: "POST" });
        const json = await response.json();
        if (response.ok && json && typeof json.access_token === "string") {
            newToken = json.access_token.replace(/['"]+/g, "").trim();
        } else {
            console.log(`HTTP ${response.status}: ${json ? json.detail : response.statusText}`);
        }
    } catch(e) {
        console.log(e);
    }
    return newToken;
}

function parseAccessTokenInput() {
    const text = form.elements['accessToken'].value;

    let accessToken;
    try {
        let json = JSON.parse(text);
        const type = Object.prototype.toString.call(json);
        if (type !== '[object Object]') {
            throw new Error("Not valid JSON object");
        }
        accessToken = json['access_token'] || json['accessToken'] || json['token'];
        if (!accessToken) {
            throw new Error("'access_token' missing from JSON");
        }
    } catch {
        accessToken = text;
    }

    try {
        accessToken = String(accessToken).replace(/['"]+/g, "").trim();
        if (accessToken.startsWith("Bearer ")) {
            accessToken = accessToken.slice(7).trim();
        }
    } catch {}

    form.elements['accessToken'].value = accessToken;
    return accessToken;
}

function directExpand(button) {
    let link = button.previousElementSibling;
    let url = link.href;
    const isGallery = (link.hasAttribute && link.hasAttribute("data-gallery")) || /(?:reddit\.com|redd\.it)\/gallery\/[a-zA-Z0-9]+/i.test(url);
    if (button.classList.contains("closed")) {
        let span = document.createElement("span");
        span.style.display = "block";
        const isRedditVideoComment = /(?:reddit\.com|redd\.it)\/(?:link\/[a-zA-Z0-9]+\/)?video\/[a-zA-Z0-9]+/i.test(url);
        if (isGallery) {
            let galleryItems = [];
            if (link.getAttribute && link.getAttribute("data-gallery")) {
                try {
                    galleryItems = JSON.parse(link.getAttribute("data-gallery") || "[]");
                } catch(e) {}
            }
            if (galleryItems.length === 0) {
                const notice = document.createElement("p");
                notice.className = "is-size-7 has-text-grey my-1";
                notice.textContent = "Gallery unavailable. Try opening the link directly.";
                span.appendChild(notice);
            } else if (galleryItems.length === 1) {
                let img = document.createElement("img");
                img.src = galleryItems[0].src;
                img.alt = galleryItems[0].caption || "Gallery image";
                img.loading = "lazy";
                img.addEventListener("error", () => {
                    const notice = document.createElement("p");
                    notice.className = "is-size-7 has-text-grey my-1";
                    notice.textContent = "Image unavailable. Try opening the link directly.";
                    if (img.replaceWith) {
                        img.replaceWith(notice);
                    } else if (img.parentNode) {
                        img.parentNode.replaceChild(notice, img);
                    }
                });
                span.appendChild(img);
                if (galleryItems[0].caption) {
                    const cap = document.createElement("p");
                    cap.className = "is-size-7 has-text-grey-light mt-1";
                    cap.textContent = galleryItems[0].caption;
                    span.appendChild(cap);
                }
            } else {
                let currentIndex = 0;
                const wrapper = document.createElement("div");
                wrapper.className = "gallery-wrapper my-2";
                wrapper.tabIndex = 0;

                const nav = document.createElement("div");
                nav.className = "gallery-nav mb-2 is-size-7";

                const controls = document.createElement("div");
                controls.className = "gallery-controls";

                const prevBtn = document.createElement("button");
                prevBtn.type = "button";
                prevBtn.className = "gallery-btn gallery-prev mr-1";
                prevBtn.textContent = "◀ Prev";
                prevBtn.disabled = true;
                prevBtn.setAttribute("aria-label", "Previous image");

                const nextBtn = document.createElement("button");
                nextBtn.type = "button";
                nextBtn.className = "gallery-btn gallery-next";
                nextBtn.textContent = "Next ▶";
                nextBtn.disabled = (galleryItems.length <= 1);
                nextBtn.setAttribute("aria-label", "Next image");

                controls.appendChild(prevBtn);
                controls.appendChild(nextBtn);
                nav.appendChild(controls);

                const counter = document.createElement("span");
                counter.className = "gallery-counter has-text-grey-light has-text-weight-semibold";
                counter.textContent = `1 of ${galleryItems.length}`;
                nav.appendChild(counter);

                wrapper.appendChild(nav);

                const mediaDiv = document.createElement("div");
                mediaDiv.className = "gallery-media";

                let img = document.createElement("img");
                img.src = galleryItems[0].src;
                img.alt = galleryItems[0].caption || `Gallery image 1 of ${galleryItems.length}`;
                img.loading = "lazy";
                const handleImgError = () => {
                    const notice = document.createElement("p");
                    notice.className = "is-size-7 has-text-grey my-1";
                    notice.textContent = "Image unavailable. Try opening the link directly.";
                    if (img.replaceWith) {
                        img.replaceWith(notice);
                    } else if (img.parentNode) {
                        img.parentNode.replaceChild(notice, img);
                    }
                };
                img.addEventListener("error", handleImgError);
                mediaDiv.appendChild(img);
                wrapper.appendChild(mediaDiv);

                const caption = document.createElement("p");
                caption.className = "gallery-caption is-size-7 has-text-grey-light mt-1";
                caption.textContent = galleryItems[0].caption || "";
                if (!galleryItems[0].caption) {
                    caption.style.display = "none";
                }
                wrapper.appendChild(caption);

                const preloadImage = (index) => {
                    if (index >= 0 && index < galleryItems.length && typeof Image !== "undefined") {
                        const pre = new Image();
                        pre.src = galleryItems[index].src;
                    }
                };
                preloadImage(1);

                const updateGalleryView = () => {
                    const item = galleryItems[currentIndex];
                    img.src = item.src;
                    img.alt = item.caption || `Gallery image ${currentIndex + 1} of ${galleryItems.length}`;
                    if (mediaDiv.contains && !mediaDiv.contains(img)) {
                        mediaDiv.innerHTML = "";
                        mediaDiv.appendChild(img);
                    }
                    counter.textContent = `${currentIndex + 1} of ${galleryItems.length}`;
                    prevBtn.disabled = (currentIndex === 0);
                    nextBtn.disabled = (currentIndex === galleryItems.length - 1);
                    if (item.caption) {
                        caption.textContent = item.caption;
                        caption.style.display = "";
                    } else {
                        caption.textContent = "";
                        caption.style.display = "none";
                    }
                    preloadImage(currentIndex + 1);
                    preloadImage(currentIndex - 1);
                };

                prevBtn.addEventListener("click", (e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    if (currentIndex > 0) {
                        currentIndex--;
                        updateGalleryView();
                    }
                });

                nextBtn.addEventListener("click", (e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    if (currentIndex < galleryItems.length - 1) {
                        currentIndex++;
                        updateGalleryView();
                    }
                });

                wrapper.addEventListener("keydown", (e) => {
                    if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        if (currentIndex > 0) {
                            currentIndex--;
                            updateGalleryView();
                        }
                    } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        if (currentIndex < galleryItems.length - 1) {
                            currentIndex++;
                            updateGalleryView();
                        }
                    }
                });

                let touchStartX = 0;
                let touchStartY = 0;
                let touchEndX = 0;
                let touchEndY = 0;

                wrapper.addEventListener("touchstart", (e) => {
                    if (e.touches && e.touches.length === 1) {
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        touchEndX = touchStartX;
                        touchEndY = touchStartY;
                    }
                }, { passive: true });

                wrapper.addEventListener("touchmove", (e) => {
                    if (e.touches && e.touches.length === 1) {
                        touchEndX = e.touches[0].clientX;
                        touchEndY = e.touches[0].clientY;
                    }
                }, { passive: true });

                wrapper.addEventListener("touchend", () => {
                    const diffX = touchEndX - touchStartX;
                    const diffY = touchEndY - touchStartY;
                    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
                        if (diffX < 0 && currentIndex < galleryItems.length - 1) {
                            currentIndex++;
                            updateGalleryView();
                        } else if (diffX > 0 && currentIndex > 0) {
                            currentIndex--;
                            updateGalleryView();
                        }
                    }
                }, { passive: true });

                span.appendChild(wrapper);
            }
        } else if (url.includes(".gifv") || url.includes(".mp4") || url.includes("v.redd.it/") || isRedditVideoComment) { // Video
            url = url.replace("gifv", "mp4");
            let video = document.createElement("video");
            video.controls = true;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;

            const redditVideoMatch = url.match(/(?:packaged-media|preview)\.redd\.it\/([a-zA-Z0-9]+)/)
                || url.match(/v\.redd\.it\/([a-zA-Z0-9]+)/)
                || url.match(/(?:reddit\.com|redd\.it)\/(?:link\/[a-zA-Z0-9]+\/)?video\/([a-zA-Z0-9]+)/i);
            if (redditVideoMatch) {
                const mediaId = redditVideoMatch[1];
                let resList = ["720", "1080", "480", "360", "220"];
                const resMatch = url.match(/res_(\d+)p/);
                if (resMatch && resList.includes(resMatch[1])) {
                    resList = [resMatch[1], ...resList.filter(r => r !== resMatch[1])];
                }
                for (const res of resList) {
                    const source = document.createElement("source");
                    source.src = `https://v.redd.it/${mediaId}/CMAF_${res}.mp4`;
                    source.type = "video/mp4";
                    video.appendChild(source);
                }
                const legacySource = document.createElement("source");
                legacySource.src = `https://v.redd.it/${mediaId}/DASH_480.mp4`;
                legacySource.type = "video/mp4";
                video.appendChild(legacySource);
            } else {
                let source = document.createElement("source");
                source.src = url;
                source.type = "video/mp4";
                video.appendChild(source);
            }

            const showVideoFallback = () => {
                const notice = document.createElement("p");
                notice.className = "is-size-7 has-text-grey my-1";
                notice.textContent = "Video playback unavailable. Try opening the link directly.";
                if (video.replaceWith) {
                    video.replaceWith(notice);
                } else if (video.parentNode) {
                    video.parentNode.replaceChild(notice, video);
                }
            };

            const sources = video.querySelectorAll ? video.querySelectorAll("source") : [];
            if (sources.length > 0) {
                sources[sources.length - 1].addEventListener("error", showVideoFallback);
            } else {
                video.addEventListener("error", showVideoFallback);
            }

            span.appendChild(video);
        } else { // Image
            url = url.replace("preview.redd.it", "i.redd.it");
            let img = document.createElement("img");
            img.src = url;
            img.alt = "Expanded media";
            img.loading = "lazy";
            img.addEventListener("error", () => {
                const notice = document.createElement("p");
                notice.className = "is-size-7 has-text-grey my-1";
                notice.textContent = "Image unavailable. Try opening the link directly.";
                if (img.replaceWith) {
                    img.replaceWith(notice);
                } else if (img.parentNode) {
                    img.parentNode.replaceChild(notice, img);
                }
            });
            span.appendChild(img);
        }
        button.after(span);
        button.setAttribute("aria-label", isGallery ? "Collapse gallery" : "Collapse media");
        button.setAttribute("title", isGallery ? "Collapse gallery" : "Collapse media");
    } else {
        let span = button.nextElementSibling;
        if (span) {
            const video = span.querySelector("video");
            if (video) {
                video.pause();
                if (video.querySelectorAll) {
                    video.querySelectorAll("source").forEach(s => s.removeAttribute("src"));
                }
                video.removeAttribute("src");
                video.load();
            }
            span.remove();
        }
        button.setAttribute("aria-label", isGallery ? "Expand gallery" : "Expand media");
        button.setAttribute("title", isGallery ? "Expand gallery" : "Expand media");
    }
    button.classList.toggle("closed");
}

function hideThumbnail(element) {
    if (!element || typeof element.closest !== "function") return;
    let thumbnail = element.closest('.media-left');
    if (thumbnail) {
        thumbnail.style.display = 'none';
    }
}

function trackEvent(eventName, eventData) {
    try {
        if (typeof window !== 'undefined' && window.umami && typeof window.umami.track === 'function') {
            window.umami.track(eventName, eventData);
        }
    } catch {}
}

document.addEventListener("click", (e) => {
    const timestampEl = e.target && typeof e.target.closest === "function" ? e.target.closest(".timestamp") : null;
    if (timestampEl) {
        timestampEl.classList.toggle("show-utc");
    }
});
