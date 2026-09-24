// test_stub.js — Stub DOM minimal pour exécuter app.js sous Node (pas de navigateur).
// Persisté dans /tests : à ÉTENDRE si un nouveau besoin apparaît, jamais à réécrire de zéro.

function makeEl() {
    const el = {
        _children: [],
        classList: {
            _set: new Set(),
            add(...c) { c.forEach(x => this._set.add(x)); },
            remove(...c) { c.forEach(x => this._set.delete(x)); },
            toggle(c, force) {
                const has = this._set.has(c);
                const want = force === undefined ? !has : !!force;
                if (want) this._set.add(c); else this._set.delete(c);
                return want;
            },
            contains(c) { return this._set.has(c); },
            replace(oldC, newC) { if (this._set.has(oldC)) { this._set.delete(oldC); this._set.add(newC); } }
        },
        style: {},
        dataset: {},
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
        _listeners: {},
        addEventListener(evt, fn) {
            (this._listeners[evt] = this._listeners[evt] || []).push(fn);
        },
        dispatch(evt, eventObj) {
            // `type` reflète toujours le nom de l'événement dispatché, comme un vrai Event du DOM —
            // en priorité sur un éventuel `type` déjà fourni par l'appelant, pour rester fidèle à un
            // vrai navigateur (un `pointerup` dispatché a TOUJOURS type === 'pointerup').
            const finalEvent = Object.assign({}, eventObj || {}, { type: evt });
            (this._listeners[evt] || []).forEach(fn => fn(finalEvent));
        },
        appendChild(child) { this._children.push(child); return child; },
        removeChild(child) { this._children = this._children.filter(c => c !== child); },
        get innerHTML() { return this._innerHTML || ""; },
        set innerHTML(v) { this._innerHTML = v; this._children = []; },
        querySelector(sel) {
            if (sel.startsWith('[data-action="')) {
                const action = sel.slice('[data-action="'.length, -2);
                return this._actionEls && this._actionEls[action] || makeEl();
            }
            return makeEl();
        },
        querySelectorAll() { return []; },
        get offsetWidth() { return 100; },
        scrollTop: 0,
        scrollHeight: 0,
        get innerText() { return this._innerText || ""; },
        set innerText(v) { this._innerText = v; },
        disabled: false
    };
    return el;
}

global.document = {
    _elements: {},
    getElementById(id) {
        if (!this._elements[id]) this._elements[id] = makeEl();
        return this._elements[id];
    },
    createElement() { return makeEl(); },
    createElementNS(_ns, _tag) { return makeEl(); },
    addEventListener() {}
};

global.navigator = { vibrate: () => true };
global.location = { reload: () => {} };
global.window = global;
global.console = console;

// Stub minimal de l'API Web Storage (localStorage), utilisée par le système de sauvegarde
// (saveGame()/restoreSaveForName() dans app.js). En mémoire pour la durée du process Node.
global.localStorage = (() => {
    let store = {};
    return {
        getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
        clear() { store = {}; },
        key(index) { return Object.keys(store)[index] || null; },
        get length() { return Object.keys(store).length; }
    };
})();

module.exports = { makeEl };
