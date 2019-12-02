
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            $$.fragment && $$.fragment.p($$.ctx, $$.dirty);
            $$.dirty = [-1];
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    /* src/components/App.svelte generated by Svelte v3.16.0 */

    const file = "src/components/App.svelte";

    function create_fragment(ctx) {
    	let h1;
    	let t0;
    	let span;
    	let t2;
    	let t3;
    	let p0;
    	let t7;
    	let p1;
    	let t10;
    	let p2;
    	let t14;
    	let p3;
    	let t15;
    	let strong;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let br;
    	let t21;
    	let p4;
    	let t22;
    	let i;
    	let t24;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("Hello ");
    			span = element("span");
    			span.textContent = `${/*name*/ ctx[1]}`;
    			t2 = text("!");
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = `We are using Node.js version ${process.versions.node},`;
    			t7 = space();
    			p1 = element("p");
    			p1.textContent = `Chromium version ${process.versions.chrome}`;
    			t10 = space();
    			p2 = element("p");
    			p2.textContent = `and Electron version ${process.versions.electron}.`;
    			t14 = space();
    			p3 = element("p");
    			t15 = text("But most importantly ");
    			strong = element("strong");
    			strong.textContent = "Svelte";
    			t17 = text(" version ");
    			t18 = text(/*version*/ ctx[0]);
    			t19 = text("!");
    			t20 = space();
    			br = element("br");
    			t21 = space();
    			p4 = element("p");
    			t22 = text("This boilerplate, in addition to using Svelte with Electron, also uses ");
    			i = element("i");
    			i.textContent = "Node-Sass";
    			t24 = text("!");
    			attr_dev(span, "class", "svelte-1whrfcs");
    			add_location(span, file, 12, 10, 210);
    			attr_dev(h1, "class", "svelte-1whrfcs");
    			add_location(h1, file, 12, 0, 200);
    			add_location(p0, file, 13, 0, 236);
    			add_location(p1, file, 14, 0, 297);
    			add_location(p2, file, 15, 0, 347);
    			add_location(strong, file, 16, 24, 428);
    			add_location(p3, file, 16, 0, 404);
    			add_location(br, file, 17, 0, 475);
    			add_location(i, file, 18, 74, 554);
    			add_location(p4, file, 18, 0, 480);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, span);
    			append_dev(h1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p0, anchor);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, p1, anchor);
    			insert_dev(target, t10, anchor);
    			insert_dev(target, p2, anchor);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, p3, anchor);
    			append_dev(p3, t15);
    			append_dev(p3, strong);
    			append_dev(p3, t17);
    			append_dev(p3, t18);
    			append_dev(p3, t19);
    			insert_dev(target, t20, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t21, anchor);
    			insert_dev(target, p4, anchor);
    			append_dev(p4, t22);
    			append_dev(p4, i);
    			append_dev(p4, t24);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*version*/ 1) set_data_dev(t18, /*version*/ ctx[0]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t10);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(p3);
    			if (detaching) detach_dev(t20);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t21);
    			if (detaching) detach_dev(p4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { version } = $$props;
    	let name = "World";
    	let test = process.versions.electron;
    	const writable_props = ["version"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ("version" in $$props) $$invalidate(0, version = $$props.version);
    	};

    	$$self.$capture_state = () => {
    		return { version, name, test };
    	};

    	$$self.$inject_state = $$props => {
    		if ("version" in $$props) $$invalidate(0, version = $$props.version);
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("test" in $$props) test = $$props.test;
    	};

    	return [version, name];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { version: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || ({});

    		if (/*version*/ ctx[0] === undefined && !("version" in props)) {
    			console.warn("<App> was created without expected prop 'version'");
    		}
    	}

    	get version() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set version(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var compiler = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
    	 factory(exports) ;
    }(commonjsGlobal, function (exports) {
    	function assign(tar, src) {
    	    // @ts-ignore
    	    for (const k in src)
    	        tar[k] = src[k];
    	    return tar;
    	}

    	const now = (typeof process !== 'undefined' && process.hrtime)
    	    ? () => {
    	        const t = process.hrtime();
    	        return t[0] * 1e3 + t[1] / 1e6;
    	    }
    	    : () => self.performance.now();
    	function collapse_timings(timings) {
    	    const result = {};
    	    timings.forEach(timing => {
    	        result[timing.label] = Object.assign({
    	            total: timing.end - timing.start
    	        }, timing.children && collapse_timings(timing.children));
    	    });
    	    return result;
    	}
    	class Stats {
    	    constructor() {
    	        this.start_time = now();
    	        this.stack = [];
    	        this.current_children = this.timings = [];
    	    }
    	    start(label) {
    	        const timing = {
    	            label,
    	            start: now(),
    	            end: null,
    	            children: []
    	        };
    	        this.current_children.push(timing);
    	        this.stack.push(timing);
    	        this.current_timing = timing;
    	        this.current_children = timing.children;
    	    }
    	    stop(label) {
    	        if (label !== this.current_timing.label) {
    	            throw new Error(`Mismatched timing labels (expected ${this.current_timing.label}, got ${label})`);
    	        }
    	        this.current_timing.end = now();
    	        this.stack.pop();
    	        this.current_timing = this.stack[this.stack.length - 1];
    	        this.current_children = this.current_timing ? this.current_timing.children : this.timings;
    	    }
    	    render() {
    	        const timings = Object.assign({
    	            total: now() - this.start_time
    	        }, collapse_timings(this.timings));
    	        return {
    	            timings
    	        };
    	    }
    	}

    	// Reserved word lists for various dialects of the language

    	var reservedWords = {
    	  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
    	  5: "class enum extends super const export import",
    	  6: "enum",
    	  strict: "implements interface let package private protected public static yield",
    	  strictBind: "eval arguments"
    	};

    	// And the keywords

    	var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

    	var keywords = {
    	  5: ecma5AndLessKeywords,
    	  "5module": ecma5AndLessKeywords + " export import",
    	  6: ecma5AndLessKeywords + " const class extends export import super"
    	};

    	var keywordRelationalOperator = /^in(stanceof)?$/;

    	// ## Character categories

    	// Big ugly regular expressions that match characters in the
    	// whitespace, identifier, and identifier-start categories. These
    	// are only applied when a character is found to actually have a
    	// code point above 128.
    	// Generated by `bin/generate-identifier-regex.js`.
    	var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u0860-\u086a\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u09fc\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0af9\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1878\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fef\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7bf\ua7c2-\ua7c6\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua8fe\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab67\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";
    	var nonASCIIidentifierChars = "\u200c\u200d\xb7\u0300-\u036f\u0387\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u07fd\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08d3-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u09fe\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0afa-\u0aff\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c00-\u0c04\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d00-\u0d03\u0d3b\u0d3c\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19d0-\u19da\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1ab0-\u1abd\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf4\u1cf7-\u1cf9\u1dc0-\u1df9\u1dfb-\u1dff\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69e\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f1\ua8ff-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\ua9e5\ua9f0-\ua9f9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";

    	var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
    	var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

    	nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;

    	// These are a run-length and offset encoded representation of the
    	// >0xffff code points that are a valid part of identifiers. The
    	// offset starts at 0x10000, and each pair of numbers represents an
    	// offset to the next range, and then a size of the range. They were
    	// generated by bin/generate-identifier-regex.js

    	// eslint-disable-next-line comma-spacing
    	var astralIdentifierStartCodes = [0,11,2,25,2,18,2,1,2,14,3,13,35,122,70,52,268,28,4,48,48,31,14,29,6,37,11,29,3,35,5,7,2,4,43,157,19,35,5,35,5,39,9,51,157,310,10,21,11,7,153,5,3,0,2,43,2,1,4,0,3,22,11,22,10,30,66,18,2,1,11,21,11,25,71,55,7,1,65,0,16,3,2,2,2,28,43,28,4,28,36,7,2,27,28,53,11,21,11,18,14,17,111,72,56,50,14,50,14,35,477,28,11,0,9,21,155,22,13,52,76,44,33,24,27,35,30,0,12,34,4,0,13,47,15,3,22,0,2,0,36,17,2,24,85,6,2,0,2,3,2,14,2,9,8,46,39,7,3,1,3,21,2,6,2,1,2,4,4,0,19,0,13,4,159,52,19,3,21,0,33,47,21,1,2,0,185,46,42,3,37,47,21,0,60,42,14,0,72,26,230,43,117,63,32,0,161,7,3,38,17,0,2,0,29,0,11,39,8,0,22,0,12,45,20,0,35,56,264,8,2,36,18,0,50,29,113,6,2,1,2,37,22,0,26,5,2,1,2,31,15,0,328,18,270,921,103,110,18,195,2749,1070,4050,582,8634,568,8,30,114,29,19,47,17,3,32,20,6,18,689,63,129,74,6,0,67,12,65,1,2,0,29,6135,9,754,9486,286,50,2,18,3,9,395,2309,106,6,12,4,8,8,9,5991,84,2,70,2,1,3,0,3,1,3,3,2,11,2,0,2,6,2,64,2,3,3,7,2,6,2,27,2,3,2,4,2,0,4,6,2,339,3,24,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,7,2357,44,11,6,17,0,370,43,1301,196,60,67,8,0,1205,3,2,26,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,16,6,2,2,4,2,16,4421,42710,42,4148,12,221,3,5761,15,7472,3104,541];

    	// eslint-disable-next-line comma-spacing
    	var astralIdentifierCodes = [509,0,227,0,150,4,294,9,1368,2,2,1,6,3,41,2,5,0,166,1,574,3,9,9,525,10,176,2,54,14,32,9,16,3,46,10,54,9,7,2,37,13,2,9,6,1,45,0,13,2,49,13,9,3,4,9,83,11,7,0,161,11,6,9,7,3,56,1,2,6,3,1,3,2,10,0,11,1,3,6,4,4,193,17,10,9,5,0,82,19,13,9,214,6,3,8,28,1,83,16,16,9,82,12,9,9,84,14,5,9,243,14,166,9,232,6,3,6,4,0,29,9,41,6,2,3,9,0,10,10,47,15,406,7,2,7,17,9,57,21,2,13,123,5,4,0,2,1,2,6,2,0,9,9,49,4,2,1,2,4,9,9,330,3,19306,9,135,4,60,6,26,9,1014,0,2,54,8,3,19723,1,5319,4,4,5,9,7,3,6,31,3,149,2,1418,49,513,54,5,49,9,0,15,0,23,4,2,14,1361,6,2,16,3,6,2,1,2,4,262,6,10,9,419,13,1495,6,110,6,6,9,792487,239];

    	// This has a complexity linear to the value of the code. The
    	// assumption is that looking up astral identifier characters is
    	// rare.
    	function isInAstralSet(code, set) {
    	  var pos = 0x10000;
    	  for (var i = 0; i < set.length; i += 2) {
    	    pos += set[i];
    	    if (pos > code) { return false }
    	    pos += set[i + 1];
    	    if (pos >= code) { return true }
    	  }
    	}

    	// Test whether a given character code starts an identifier.

    	function isIdentifierStart(code, astral) {
    	  if (code < 65) { return code === 36 }
    	  if (code < 91) { return true }
    	  if (code < 97) { return code === 95 }
    	  if (code < 123) { return true }
    	  if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code)) }
    	  if (astral === false) { return false }
    	  return isInAstralSet(code, astralIdentifierStartCodes)
    	}

    	// Test whether a given character is part of an identifier.

    	function isIdentifierChar(code, astral) {
    	  if (code < 48) { return code === 36 }
    	  if (code < 58) { return true }
    	  if (code < 65) { return false }
    	  if (code < 91) { return true }
    	  if (code < 97) { return code === 95 }
    	  if (code < 123) { return true }
    	  if (code <= 0xffff) { return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code)) }
    	  if (astral === false) { return false }
    	  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes)
    	}

    	// ## Token types

    	// The assignment of fine-grained, information-carrying type objects
    	// allows the tokenizer to store the information it has about a
    	// token in a way that is very cheap for the parser to look up.

    	// All token type variables start with an underscore, to make them
    	// easy to recognize.

    	// The `beforeExpr` property is used to disambiguate between regular
    	// expressions and divisions. It is set on all token types that can
    	// be followed by an expression (thus, a slash after them would be a
    	// regular expression).
    	//
    	// The `startsExpr` property is used to check if the token ends a
    	// `yield` expression. It is set on all token types that either can
    	// directly start an expression (like a quotation mark) or can
    	// continue an expression (like the body of a string).
    	//
    	// `isLoop` marks a keyword as starting a loop, which is important
    	// to know when parsing a label, in order to allow or disallow
    	// continue jumps to that label.

    	var TokenType = function TokenType(label, conf) {
    	  if ( conf === void 0 ) conf = {};

    	  this.label = label;
    	  this.keyword = conf.keyword;
    	  this.beforeExpr = !!conf.beforeExpr;
    	  this.startsExpr = !!conf.startsExpr;
    	  this.isLoop = !!conf.isLoop;
    	  this.isAssign = !!conf.isAssign;
    	  this.prefix = !!conf.prefix;
    	  this.postfix = !!conf.postfix;
    	  this.binop = conf.binop || null;
    	  this.updateContext = null;
    	};

    	function binop(name, prec) {
    	  return new TokenType(name, {beforeExpr: true, binop: prec})
    	}
    	var beforeExpr = {beforeExpr: true}, startsExpr = {startsExpr: true};

    	// Map keyword names to token types.

    	var keywords$1 = {};

    	// Succinct definitions of keyword token types
    	function kw(name, options) {
    	  if ( options === void 0 ) options = {};

    	  options.keyword = name;
    	  return keywords$1[name] = new TokenType(name, options)
    	}

    	var types = {
    	  num: new TokenType("num", startsExpr),
    	  regexp: new TokenType("regexp", startsExpr),
    	  string: new TokenType("string", startsExpr),
    	  name: new TokenType("name", startsExpr),
    	  eof: new TokenType("eof"),

    	  // Punctuation token types.
    	  bracketL: new TokenType("[", {beforeExpr: true, startsExpr: true}),
    	  bracketR: new TokenType("]"),
    	  braceL: new TokenType("{", {beforeExpr: true, startsExpr: true}),
    	  braceR: new TokenType("}"),
    	  parenL: new TokenType("(", {beforeExpr: true, startsExpr: true}),
    	  parenR: new TokenType(")"),
    	  comma: new TokenType(",", beforeExpr),
    	  semi: new TokenType(";", beforeExpr),
    	  colon: new TokenType(":", beforeExpr),
    	  dot: new TokenType("."),
    	  question: new TokenType("?", beforeExpr),
    	  arrow: new TokenType("=>", beforeExpr),
    	  template: new TokenType("template"),
    	  invalidTemplate: new TokenType("invalidTemplate"),
    	  ellipsis: new TokenType("...", beforeExpr),
    	  backQuote: new TokenType("`", startsExpr),
    	  dollarBraceL: new TokenType("${", {beforeExpr: true, startsExpr: true}),

    	  // Operators. These carry several kinds of properties to help the
    	  // parser use them properly (the presence of these properties is
    	  // what categorizes them as operators).
    	  //
    	  // `binop`, when present, specifies that this operator is a binary
    	  // operator, and will refer to its precedence.
    	  //
    	  // `prefix` and `postfix` mark the operator as a prefix or postfix
    	  // unary operator.
    	  //
    	  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
    	  // binary operators with a very low precedence, that should result
    	  // in AssignmentExpression nodes.

    	  eq: new TokenType("=", {beforeExpr: true, isAssign: true}),
    	  assign: new TokenType("_=", {beforeExpr: true, isAssign: true}),
    	  incDec: new TokenType("++/--", {prefix: true, postfix: true, startsExpr: true}),
    	  prefix: new TokenType("!/~", {beforeExpr: true, prefix: true, startsExpr: true}),
    	  logicalOR: binop("||", 1),
    	  logicalAND: binop("&&", 2),
    	  bitwiseOR: binop("|", 3),
    	  bitwiseXOR: binop("^", 4),
    	  bitwiseAND: binop("&", 5),
    	  equality: binop("==/!=/===/!==", 6),
    	  relational: binop("</>/<=/>=", 7),
    	  bitShift: binop("<</>>/>>>", 8),
    	  plusMin: new TokenType("+/-", {beforeExpr: true, binop: 9, prefix: true, startsExpr: true}),
    	  modulo: binop("%", 10),
    	  star: binop("*", 10),
    	  slash: binop("/", 10),
    	  starstar: new TokenType("**", {beforeExpr: true}),

    	  // Keyword token types.
    	  _break: kw("break"),
    	  _case: kw("case", beforeExpr),
    	  _catch: kw("catch"),
    	  _continue: kw("continue"),
    	  _debugger: kw("debugger"),
    	  _default: kw("default", beforeExpr),
    	  _do: kw("do", {isLoop: true, beforeExpr: true}),
    	  _else: kw("else", beforeExpr),
    	  _finally: kw("finally"),
    	  _for: kw("for", {isLoop: true}),
    	  _function: kw("function", startsExpr),
    	  _if: kw("if"),
    	  _return: kw("return", beforeExpr),
    	  _switch: kw("switch"),
    	  _throw: kw("throw", beforeExpr),
    	  _try: kw("try"),
    	  _var: kw("var"),
    	  _const: kw("const"),
    	  _while: kw("while", {isLoop: true}),
    	  _with: kw("with"),
    	  _new: kw("new", {beforeExpr: true, startsExpr: true}),
    	  _this: kw("this", startsExpr),
    	  _super: kw("super", startsExpr),
    	  _class: kw("class", startsExpr),
    	  _extends: kw("extends", beforeExpr),
    	  _export: kw("export"),
    	  _import: kw("import", startsExpr),
    	  _null: kw("null", startsExpr),
    	  _true: kw("true", startsExpr),
    	  _false: kw("false", startsExpr),
    	  _in: kw("in", {beforeExpr: true, binop: 7}),
    	  _instanceof: kw("instanceof", {beforeExpr: true, binop: 7}),
    	  _typeof: kw("typeof", {beforeExpr: true, prefix: true, startsExpr: true}),
    	  _void: kw("void", {beforeExpr: true, prefix: true, startsExpr: true}),
    	  _delete: kw("delete", {beforeExpr: true, prefix: true, startsExpr: true})
    	};

    	// Matches a whole line break (where CRLF is considered a single
    	// line break). Used to count lines.

    	var lineBreak = /\r\n?|\n|\u2028|\u2029/;
    	var lineBreakG = new RegExp(lineBreak.source, "g");

    	function isNewLine(code, ecma2019String) {
    	  return code === 10 || code === 13 || (!ecma2019String && (code === 0x2028 || code === 0x2029))
    	}

    	var nonASCIIwhitespace = /[\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

    	var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g;

    	var ref = Object.prototype;
    	var hasOwnProperty = ref.hasOwnProperty;
    	var toString = ref.toString;

    	// Checks if an object has a property.

    	function has(obj, propName) {
    	  return hasOwnProperty.call(obj, propName)
    	}

    	var isArray = Array.isArray || (function (obj) { return (
    	  toString.call(obj) === "[object Array]"
    	); });

    	function wordsRegexp(words) {
    	  return new RegExp("^(?:" + words.replace(/ /g, "|") + ")$")
    	}

    	// These are used when `options.locations` is on, for the
    	// `startLoc` and `endLoc` properties.

    	var Position = function Position(line, col) {
    	  this.line = line;
    	  this.column = col;
    	};

    	Position.prototype.offset = function offset (n) {
    	  return new Position(this.line, this.column + n)
    	};

    	var SourceLocation = function SourceLocation(p, start, end) {
    	  this.start = start;
    	  this.end = end;
    	  if (p.sourceFile !== null) { this.source = p.sourceFile; }
    	};

    	// The `getLineInfo` function is mostly useful when the
    	// `locations` option is off (for performance reasons) and you
    	// want to find the line/column position for a given character
    	// offset. `input` should be the code string that the offset refers
    	// into.

    	function getLineInfo(input, offset) {
    	  for (var line = 1, cur = 0;;) {
    	    lineBreakG.lastIndex = cur;
    	    var match = lineBreakG.exec(input);
    	    if (match && match.index < offset) {
    	      ++line;
    	      cur = match.index + match[0].length;
    	    } else {
    	      return new Position(line, offset - cur)
    	    }
    	  }
    	}

    	// A second optional argument can be given to further configure
    	// the parser process. These options are recognized:

    	var defaultOptions = {
    	  // `ecmaVersion` indicates the ECMAScript version to parse. Must be
    	  // either 3, 5, 6 (2015), 7 (2016), 8 (2017), 9 (2018), or 10
    	  // (2019). This influences support for strict mode, the set of
    	  // reserved words, and support for new syntax features. The default
    	  // is 10.
    	  ecmaVersion: 10,
    	  // `sourceType` indicates the mode the code should be parsed in.
    	  // Can be either `"script"` or `"module"`. This influences global
    	  // strict mode and parsing of `import` and `export` declarations.
    	  sourceType: "script",
    	  // `onInsertedSemicolon` can be a callback that will be called
    	  // when a semicolon is automatically inserted. It will be passed
    	  // the position of the comma as an offset, and if `locations` is
    	  // enabled, it is given the location as a `{line, column}` object
    	  // as second argument.
    	  onInsertedSemicolon: null,
    	  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
    	  // trailing commas.
    	  onTrailingComma: null,
    	  // By default, reserved words are only enforced if ecmaVersion >= 5.
    	  // Set `allowReserved` to a boolean value to explicitly turn this on
    	  // an off. When this option has the value "never", reserved words
    	  // and keywords can also not be used as property names.
    	  allowReserved: null,
    	  // When enabled, a return at the top level is not considered an
    	  // error.
    	  allowReturnOutsideFunction: false,
    	  // When enabled, import/export statements are not constrained to
    	  // appearing at the top of the program.
    	  allowImportExportEverywhere: false,
    	  // When enabled, await identifiers are allowed to appear at the top-level scope,
    	  // but they are still not allowed in non-async functions.
    	  allowAwaitOutsideFunction: false,
    	  // When enabled, hashbang directive in the beginning of file
    	  // is allowed and treated as a line comment.
    	  allowHashBang: false,
    	  // When `locations` is on, `loc` properties holding objects with
    	  // `start` and `end` properties in `{line, column}` form (with
    	  // line being 1-based and column 0-based) will be attached to the
    	  // nodes.
    	  locations: false,
    	  // A function can be passed as `onToken` option, which will
    	  // cause Acorn to call that function with object in the same
    	  // format as tokens returned from `tokenizer().getToken()`. Note
    	  // that you are not allowed to call the parser from the
    	  // callback—that will corrupt its internal state.
    	  onToken: null,
    	  // A function can be passed as `onComment` option, which will
    	  // cause Acorn to call that function with `(block, text, start,
    	  // end)` parameters whenever a comment is skipped. `block` is a
    	  // boolean indicating whether this is a block (`/* */`) comment,
    	  // `text` is the content of the comment, and `start` and `end` are
    	  // character offsets that denote the start and end of the comment.
    	  // When the `locations` option is on, two more parameters are
    	  // passed, the full `{line, column}` locations of the start and
    	  // end of the comments. Note that you are not allowed to call the
    	  // parser from the callback—that will corrupt its internal state.
    	  onComment: null,
    	  // Nodes have their start and end characters offsets recorded in
    	  // `start` and `end` properties (directly on the node, rather than
    	  // the `loc` object, which holds line/column data. To also add a
    	  // [semi-standardized][range] `range` property holding a `[start,
    	  // end]` array with the same numbers, set the `ranges` option to
    	  // `true`.
    	  //
    	  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
    	  ranges: false,
    	  // It is possible to parse multiple files into a single AST by
    	  // passing the tree produced by parsing the first file as
    	  // `program` option in subsequent parses. This will add the
    	  // toplevel forms of the parsed file to the `Program` (top) node
    	  // of an existing parse tree.
    	  program: null,
    	  // When `locations` is on, you can pass this to record the source
    	  // file in every node's `loc` object.
    	  sourceFile: null,
    	  // This value, if given, is stored in every node, whether
    	  // `locations` is on or off.
    	  directSourceFile: null,
    	  // When enabled, parenthesized expressions are represented by
    	  // (non-standard) ParenthesizedExpression nodes
    	  preserveParens: false
    	};

    	// Interpret and default an options object

    	function getOptions(opts) {
    	  var options = {};

    	  for (var opt in defaultOptions)
    	    { options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt]; }

    	  if (options.ecmaVersion >= 2015)
    	    { options.ecmaVersion -= 2009; }

    	  if (options.allowReserved == null)
    	    { options.allowReserved = options.ecmaVersion < 5; }

    	  if (isArray(options.onToken)) {
    	    var tokens = options.onToken;
    	    options.onToken = function (token) { return tokens.push(token); };
    	  }
    	  if (isArray(options.onComment))
    	    { options.onComment = pushComment(options, options.onComment); }

    	  return options
    	}

    	function pushComment(options, array) {
    	  return function(block, text, start, end, startLoc, endLoc) {
    	    var comment = {
    	      type: block ? "Block" : "Line",
    	      value: text,
    	      start: start,
    	      end: end
    	    };
    	    if (options.locations)
    	      { comment.loc = new SourceLocation(this, startLoc, endLoc); }
    	    if (options.ranges)
    	      { comment.range = [start, end]; }
    	    array.push(comment);
    	  }
    	}

    	// Each scope gets a bitset that may contain these flags
    	var
    	    SCOPE_TOP = 1,
    	    SCOPE_FUNCTION = 2,
    	    SCOPE_VAR = SCOPE_TOP | SCOPE_FUNCTION,
    	    SCOPE_ASYNC = 4,
    	    SCOPE_GENERATOR = 8,
    	    SCOPE_ARROW = 16,
    	    SCOPE_SIMPLE_CATCH = 32,
    	    SCOPE_SUPER = 64,
    	    SCOPE_DIRECT_SUPER = 128;

    	function functionFlags(async, generator) {
    	  return SCOPE_FUNCTION | (async ? SCOPE_ASYNC : 0) | (generator ? SCOPE_GENERATOR : 0)
    	}

    	// Used in checkLVal and declareName to determine the type of a binding
    	var
    	    BIND_NONE = 0, // Not a binding
    	    BIND_VAR = 1, // Var-style binding
    	    BIND_LEXICAL = 2, // Let- or const-style binding
    	    BIND_FUNCTION = 3, // Function declaration
    	    BIND_SIMPLE_CATCH = 4, // Simple (identifier pattern) catch binding
    	    BIND_OUTSIDE = 5; // Special case for function names as bound inside the function

    	var Parser = function Parser(options, input, startPos) {
    	  this.options = options = getOptions(options);
    	  this.sourceFile = options.sourceFile;
    	  this.keywords = wordsRegexp(keywords[options.ecmaVersion >= 6 ? 6 : options.sourceType === "module" ? "5module" : 5]);
    	  var reserved = "";
    	  if (options.allowReserved !== true) {
    	    for (var v = options.ecmaVersion;; v--)
    	      { if (reserved = reservedWords[v]) { break } }
    	    if (options.sourceType === "module") { reserved += " await"; }
    	  }
    	  this.reservedWords = wordsRegexp(reserved);
    	  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict;
    	  this.reservedWordsStrict = wordsRegexp(reservedStrict);
    	  this.reservedWordsStrictBind = wordsRegexp(reservedStrict + " " + reservedWords.strictBind);
    	  this.input = String(input);

    	  // Used to signal to callers of `readWord1` whether the word
    	  // contained any escape sequences. This is needed because words with
    	  // escape sequences must not be interpreted as keywords.
    	  this.containsEsc = false;

    	  // Set up token state

    	  // The current position of the tokenizer in the input.
    	  if (startPos) {
    	    this.pos = startPos;
    	    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1;
    	    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
    	  } else {
    	    this.pos = this.lineStart = 0;
    	    this.curLine = 1;
    	  }

    	  // Properties of the current token:
    	  // Its type
    	  this.type = types.eof;
    	  // For tokens that include more information than their type, the value
    	  this.value = null;
    	  // Its start and end offset
    	  this.start = this.end = this.pos;
    	  // And, if locations are used, the {line, column} object
    	  // corresponding to those offsets
    	  this.startLoc = this.endLoc = this.curPosition();

    	  // Position information for the previous token
    	  this.lastTokEndLoc = this.lastTokStartLoc = null;
    	  this.lastTokStart = this.lastTokEnd = this.pos;

    	  // The context stack is used to superficially track syntactic
    	  // context to predict whether a regular expression is allowed in a
    	  // given position.
    	  this.context = this.initialContext();
    	  this.exprAllowed = true;

    	  // Figure out if it's a module code.
    	  this.inModule = options.sourceType === "module";
    	  this.strict = this.inModule || this.strictDirective(this.pos);

    	  // Used to signify the start of a potential arrow function
    	  this.potentialArrowAt = -1;

    	  // Positions to delayed-check that yield/await does not exist in default parameters.
    	  this.yieldPos = this.awaitPos = this.awaitIdentPos = 0;
    	  // Labels in scope.
    	  this.labels = [];
    	  // Thus-far undefined exports.
    	  this.undefinedExports = {};

    	  // If enabled, skip leading hashbang line.
    	  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === "#!")
    	    { this.skipLineComment(2); }

    	  // Scope tracking for duplicate variable names (see scope.js)
    	  this.scopeStack = [];
    	  this.enterScope(SCOPE_TOP);

    	  // For RegExp validation
    	  this.regexpState = null;
    	};

    	var prototypeAccessors = { inFunction: { configurable: true },inGenerator: { configurable: true },inAsync: { configurable: true },allowSuper: { configurable: true },allowDirectSuper: { configurable: true },treatFunctionsAsVar: { configurable: true } };

    	Parser.prototype.parse = function parse () {
    	  var node = this.options.program || this.startNode();
    	  this.nextToken();
    	  return this.parseTopLevel(node)
    	};

    	prototypeAccessors.inFunction.get = function () { return (this.currentVarScope().flags & SCOPE_FUNCTION) > 0 };
    	prototypeAccessors.inGenerator.get = function () { return (this.currentVarScope().flags & SCOPE_GENERATOR) > 0 };
    	prototypeAccessors.inAsync.get = function () { return (this.currentVarScope().flags & SCOPE_ASYNC) > 0 };
    	prototypeAccessors.allowSuper.get = function () { return (this.currentThisScope().flags & SCOPE_SUPER) > 0 };
    	prototypeAccessors.allowDirectSuper.get = function () { return (this.currentThisScope().flags & SCOPE_DIRECT_SUPER) > 0 };
    	prototypeAccessors.treatFunctionsAsVar.get = function () { return this.treatFunctionsAsVarInScope(this.currentScope()) };

    	// Switch to a getter for 7.0.0.
    	Parser.prototype.inNonArrowFunction = function inNonArrowFunction () { return (this.currentThisScope().flags & SCOPE_FUNCTION) > 0 };

    	Parser.extend = function extend () {
    	    var plugins = [], len = arguments.length;
    	    while ( len-- ) plugins[ len ] = arguments[ len ];

    	  var cls = this;
    	  for (var i = 0; i < plugins.length; i++) { cls = plugins[i](cls); }
    	  return cls
    	};

    	Parser.parse = function parse (input, options) {
    	  return new this(options, input).parse()
    	};

    	Parser.parseExpressionAt = function parseExpressionAt (input, pos, options) {
    	  var parser = new this(options, input, pos);
    	  parser.nextToken();
    	  return parser.parseExpression()
    	};

    	Parser.tokenizer = function tokenizer (input, options) {
    	  return new this(options, input)
    	};

    	Object.defineProperties( Parser.prototype, prototypeAccessors );

    	var pp = Parser.prototype;

    	// ## Parser utilities

    	var literal = /^(?:'((?:\\.|[^'])*?)'|"((?:\\.|[^"])*?)")/;
    	pp.strictDirective = function(start) {
    	  for (;;) {
    	    // Try to find string literal.
    	    skipWhiteSpace.lastIndex = start;
    	    start += skipWhiteSpace.exec(this.input)[0].length;
    	    var match = literal.exec(this.input.slice(start));
    	    if (!match) { return false }
    	    if ((match[1] || match[2]) === "use strict") { return true }
    	    start += match[0].length;

    	    // Skip semicolon, if any.
    	    skipWhiteSpace.lastIndex = start;
    	    start += skipWhiteSpace.exec(this.input)[0].length;
    	    if (this.input[start] === ";")
    	      { start++; }
    	  }
    	};

    	// Predicate that tests whether the next token is of the given
    	// type, and if yes, consumes it as a side effect.

    	pp.eat = function(type) {
    	  if (this.type === type) {
    	    this.next();
    	    return true
    	  } else {
    	    return false
    	  }
    	};

    	// Tests whether parsed token is a contextual keyword.

    	pp.isContextual = function(name) {
    	  return this.type === types.name && this.value === name && !this.containsEsc
    	};

    	// Consumes contextual keyword if possible.

    	pp.eatContextual = function(name) {
    	  if (!this.isContextual(name)) { return false }
    	  this.next();
    	  return true
    	};

    	// Asserts that following token is given contextual keyword.

    	pp.expectContextual = function(name) {
    	  if (!this.eatContextual(name)) { this.unexpected(); }
    	};

    	// Test whether a semicolon can be inserted at the current position.

    	pp.canInsertSemicolon = function() {
    	  return this.type === types.eof ||
    	    this.type === types.braceR ||
    	    lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
    	};

    	pp.insertSemicolon = function() {
    	  if (this.canInsertSemicolon()) {
    	    if (this.options.onInsertedSemicolon)
    	      { this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc); }
    	    return true
    	  }
    	};

    	// Consume a semicolon, or, failing that, see if we are allowed to
    	// pretend that there is a semicolon at this position.

    	pp.semicolon = function() {
    	  if (!this.eat(types.semi) && !this.insertSemicolon()) { this.unexpected(); }
    	};

    	pp.afterTrailingComma = function(tokType, notNext) {
    	  if (this.type === tokType) {
    	    if (this.options.onTrailingComma)
    	      { this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc); }
    	    if (!notNext)
    	      { this.next(); }
    	    return true
    	  }
    	};

    	// Expect a token of a given type. If found, consume it, otherwise,
    	// raise an unexpected token error.

    	pp.expect = function(type) {
    	  this.eat(type) || this.unexpected();
    	};

    	// Raise an unexpected token error.

    	pp.unexpected = function(pos) {
    	  this.raise(pos != null ? pos : this.start, "Unexpected token");
    	};

    	function DestructuringErrors() {
    	  this.shorthandAssign =
    	  this.trailingComma =
    	  this.parenthesizedAssign =
    	  this.parenthesizedBind =
    	  this.doubleProto =
    	    -1;
    	}

    	pp.checkPatternErrors = function(refDestructuringErrors, isAssign) {
    	  if (!refDestructuringErrors) { return }
    	  if (refDestructuringErrors.trailingComma > -1)
    	    { this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element"); }
    	  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind;
    	  if (parens > -1) { this.raiseRecoverable(parens, "Parenthesized pattern"); }
    	};

    	pp.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
    	  if (!refDestructuringErrors) { return false }
    	  var shorthandAssign = refDestructuringErrors.shorthandAssign;
    	  var doubleProto = refDestructuringErrors.doubleProto;
    	  if (!andThrow) { return shorthandAssign >= 0 || doubleProto >= 0 }
    	  if (shorthandAssign >= 0)
    	    { this.raise(shorthandAssign, "Shorthand property assignments are valid only in destructuring patterns"); }
    	  if (doubleProto >= 0)
    	    { this.raiseRecoverable(doubleProto, "Redefinition of __proto__ property"); }
    	};

    	pp.checkYieldAwaitInDefaultParams = function() {
    	  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos))
    	    { this.raise(this.yieldPos, "Yield expression cannot be a default value"); }
    	  if (this.awaitPos)
    	    { this.raise(this.awaitPos, "Await expression cannot be a default value"); }
    	};

    	pp.isSimpleAssignTarget = function(expr) {
    	  if (expr.type === "ParenthesizedExpression")
    	    { return this.isSimpleAssignTarget(expr.expression) }
    	  return expr.type === "Identifier" || expr.type === "MemberExpression"
    	};

    	var pp$1 = Parser.prototype;

    	// ### Statement parsing

    	// Parse a program. Initializes the parser, reads any number of
    	// statements, and wraps them in a Program node.  Optionally takes a
    	// `program` argument.  If present, the statements will be appended
    	// to its body instead of creating a new node.

    	pp$1.parseTopLevel = function(node) {
    	  var exports = {};
    	  if (!node.body) { node.body = []; }
    	  while (this.type !== types.eof) {
    	    var stmt = this.parseStatement(null, true, exports);
    	    node.body.push(stmt);
    	  }
    	  if (this.inModule)
    	    { for (var i = 0, list = Object.keys(this.undefinedExports); i < list.length; i += 1)
    	      {
    	        var name = list[i];

    	        this.raiseRecoverable(this.undefinedExports[name].start, ("Export '" + name + "' is not defined"));
    	      } }
    	  this.adaptDirectivePrologue(node.body);
    	  this.next();
    	  node.sourceType = this.options.sourceType;
    	  return this.finishNode(node, "Program")
    	};

    	var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

    	pp$1.isLet = function(context) {
    	  if (this.options.ecmaVersion < 6 || !this.isContextual("let")) { return false }
    	  skipWhiteSpace.lastIndex = this.pos;
    	  var skip = skipWhiteSpace.exec(this.input);
    	  var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
    	  // For ambiguous cases, determine if a LexicalDeclaration (or only a
    	  // Statement) is allowed here. If context is not empty then only a Statement
    	  // is allowed. However, `let [` is an explicit negative lookahead for
    	  // ExpressionStatement, so special-case it first.
    	  if (nextCh === 91) { return true } // '['
    	  if (context) { return false }

    	  if (nextCh === 123) { return true } // '{'
    	  if (isIdentifierStart(nextCh, true)) {
    	    var pos = next + 1;
    	    while (isIdentifierChar(this.input.charCodeAt(pos), true)) { ++pos; }
    	    var ident = this.input.slice(next, pos);
    	    if (!keywordRelationalOperator.test(ident)) { return true }
    	  }
    	  return false
    	};

    	// check 'async [no LineTerminator here] function'
    	// - 'async /*foo*/ function' is OK.
    	// - 'async /*\n*/ function' is invalid.
    	pp$1.isAsyncFunction = function() {
    	  if (this.options.ecmaVersion < 8 || !this.isContextual("async"))
    	    { return false }

    	  skipWhiteSpace.lastIndex = this.pos;
    	  var skip = skipWhiteSpace.exec(this.input);
    	  var next = this.pos + skip[0].length;
    	  return !lineBreak.test(this.input.slice(this.pos, next)) &&
    	    this.input.slice(next, next + 8) === "function" &&
    	    (next + 8 === this.input.length || !isIdentifierChar(this.input.charAt(next + 8)))
    	};

    	// Parse a single statement.
    	//
    	// If expecting a statement and finding a slash operator, parse a
    	// regular expression literal. This is to handle cases like
    	// `if (foo) /blah/.exec(foo)`, where looking at the previous token
    	// does not help.

    	pp$1.parseStatement = function(context, topLevel, exports) {
    	  var starttype = this.type, node = this.startNode(), kind;

    	  if (this.isLet(context)) {
    	    starttype = types._var;
    	    kind = "let";
    	  }

    	  // Most types of statements are recognized by the keyword they
    	  // start with. Many are trivial to parse, some require a bit of
    	  // complexity.

    	  switch (starttype) {
    	  case types._break: case types._continue: return this.parseBreakContinueStatement(node, starttype.keyword)
    	  case types._debugger: return this.parseDebuggerStatement(node)
    	  case types._do: return this.parseDoStatement(node)
    	  case types._for: return this.parseForStatement(node)
    	  case types._function:
    	    // Function as sole body of either an if statement or a labeled statement
    	    // works, but not when it is part of a labeled statement that is the sole
    	    // body of an if statement.
    	    if ((context && (this.strict || context !== "if" && context !== "label")) && this.options.ecmaVersion >= 6) { this.unexpected(); }
    	    return this.parseFunctionStatement(node, false, !context)
    	  case types._class:
    	    if (context) { this.unexpected(); }
    	    return this.parseClass(node, true)
    	  case types._if: return this.parseIfStatement(node)
    	  case types._return: return this.parseReturnStatement(node)
    	  case types._switch: return this.parseSwitchStatement(node)
    	  case types._throw: return this.parseThrowStatement(node)
    	  case types._try: return this.parseTryStatement(node)
    	  case types._const: case types._var:
    	    kind = kind || this.value;
    	    if (context && kind !== "var") { this.unexpected(); }
    	    return this.parseVarStatement(node, kind)
    	  case types._while: return this.parseWhileStatement(node)
    	  case types._with: return this.parseWithStatement(node)
    	  case types.braceL: return this.parseBlock(true, node)
    	  case types.semi: return this.parseEmptyStatement(node)
    	  case types._export:
    	  case types._import:
    	    if (this.options.ecmaVersion > 10 && starttype === types._import) {
    	      skipWhiteSpace.lastIndex = this.pos;
    	      var skip = skipWhiteSpace.exec(this.input);
    	      var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next);
    	      if (nextCh === 40) // '('
    	        { return this.parseExpressionStatement(node, this.parseExpression()) }
    	    }

    	    if (!this.options.allowImportExportEverywhere) {
    	      if (!topLevel)
    	        { this.raise(this.start, "'import' and 'export' may only appear at the top level"); }
    	      if (!this.inModule)
    	        { this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'"); }
    	    }
    	    return starttype === types._import ? this.parseImport(node) : this.parseExport(node, exports)

    	    // If the statement does not start with a statement keyword or a
    	    // brace, it's an ExpressionStatement or LabeledStatement. We
    	    // simply start parsing an expression, and afterwards, if the
    	    // next token is a colon and the expression was a simple
    	    // Identifier node, we switch to interpreting it as a label.
    	  default:
    	    if (this.isAsyncFunction()) {
    	      if (context) { this.unexpected(); }
    	      this.next();
    	      return this.parseFunctionStatement(node, true, !context)
    	    }

    	    var maybeName = this.value, expr = this.parseExpression();
    	    if (starttype === types.name && expr.type === "Identifier" && this.eat(types.colon))
    	      { return this.parseLabeledStatement(node, maybeName, expr, context) }
    	    else { return this.parseExpressionStatement(node, expr) }
    	  }
    	};

    	pp$1.parseBreakContinueStatement = function(node, keyword) {
    	  var isBreak = keyword === "break";
    	  this.next();
    	  if (this.eat(types.semi) || this.insertSemicolon()) { node.label = null; }
    	  else if (this.type !== types.name) { this.unexpected(); }
    	  else {
    	    node.label = this.parseIdent();
    	    this.semicolon();
    	  }

    	  // Verify that there is an actual destination to break or
    	  // continue to.
    	  var i = 0;
    	  for (; i < this.labels.length; ++i) {
    	    var lab = this.labels[i];
    	    if (node.label == null || lab.name === node.label.name) {
    	      if (lab.kind != null && (isBreak || lab.kind === "loop")) { break }
    	      if (node.label && isBreak) { break }
    	    }
    	  }
    	  if (i === this.labels.length) { this.raise(node.start, "Unsyntactic " + keyword); }
    	  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement")
    	};

    	pp$1.parseDebuggerStatement = function(node) {
    	  this.next();
    	  this.semicolon();
    	  return this.finishNode(node, "DebuggerStatement")
    	};

    	pp$1.parseDoStatement = function(node) {
    	  this.next();
    	  this.labels.push(loopLabel);
    	  node.body = this.parseStatement("do");
    	  this.labels.pop();
    	  this.expect(types._while);
    	  node.test = this.parseParenExpression();
    	  if (this.options.ecmaVersion >= 6)
    	    { this.eat(types.semi); }
    	  else
    	    { this.semicolon(); }
    	  return this.finishNode(node, "DoWhileStatement")
    	};

    	// Disambiguating between a `for` and a `for`/`in` or `for`/`of`
    	// loop is non-trivial. Basically, we have to parse the init `var`
    	// statement or expression, disallowing the `in` operator (see
    	// the second parameter to `parseExpression`), and then check
    	// whether the next token is `in` or `of`. When there is no init
    	// part (semicolon immediately after the opening parenthesis), it
    	// is a regular `for` loop.

    	pp$1.parseForStatement = function(node) {
    	  this.next();
    	  var awaitAt = (this.options.ecmaVersion >= 9 && (this.inAsync || (!this.inFunction && this.options.allowAwaitOutsideFunction)) && this.eatContextual("await")) ? this.lastTokStart : -1;
    	  this.labels.push(loopLabel);
    	  this.enterScope(0);
    	  this.expect(types.parenL);
    	  if (this.type === types.semi) {
    	    if (awaitAt > -1) { this.unexpected(awaitAt); }
    	    return this.parseFor(node, null)
    	  }
    	  var isLet = this.isLet();
    	  if (this.type === types._var || this.type === types._const || isLet) {
    	    var init$1 = this.startNode(), kind = isLet ? "let" : this.value;
    	    this.next();
    	    this.parseVar(init$1, true, kind);
    	    this.finishNode(init$1, "VariableDeclaration");
    	    if ((this.type === types._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) && init$1.declarations.length === 1) {
    	      if (this.options.ecmaVersion >= 9) {
    	        if (this.type === types._in) {
    	          if (awaitAt > -1) { this.unexpected(awaitAt); }
    	        } else { node.await = awaitAt > -1; }
    	      }
    	      return this.parseForIn(node, init$1)
    	    }
    	    if (awaitAt > -1) { this.unexpected(awaitAt); }
    	    return this.parseFor(node, init$1)
    	  }
    	  var refDestructuringErrors = new DestructuringErrors;
    	  var init = this.parseExpression(true, refDestructuringErrors);
    	  if (this.type === types._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
    	    if (this.options.ecmaVersion >= 9) {
    	      if (this.type === types._in) {
    	        if (awaitAt > -1) { this.unexpected(awaitAt); }
    	      } else { node.await = awaitAt > -1; }
    	    }
    	    this.toAssignable(init, false, refDestructuringErrors);
    	    this.checkLVal(init);
    	    return this.parseForIn(node, init)
    	  } else {
    	    this.checkExpressionErrors(refDestructuringErrors, true);
    	  }
    	  if (awaitAt > -1) { this.unexpected(awaitAt); }
    	  return this.parseFor(node, init)
    	};

    	pp$1.parseFunctionStatement = function(node, isAsync, declarationPosition) {
    	  this.next();
    	  return this.parseFunction(node, FUNC_STATEMENT | (declarationPosition ? 0 : FUNC_HANGING_STATEMENT), false, isAsync)
    	};

    	pp$1.parseIfStatement = function(node) {
    	  this.next();
    	  node.test = this.parseParenExpression();
    	  // allow function declarations in branches, but only in non-strict mode
    	  node.consequent = this.parseStatement("if");
    	  node.alternate = this.eat(types._else) ? this.parseStatement("if") : null;
    	  return this.finishNode(node, "IfStatement")
    	};

    	pp$1.parseReturnStatement = function(node) {
    	  if (!this.inFunction && !this.options.allowReturnOutsideFunction)
    	    { this.raise(this.start, "'return' outside of function"); }
    	  this.next();

    	  // In `return` (and `break`/`continue`), the keywords with
    	  // optional arguments, we eagerly look for a semicolon or the
    	  // possibility to insert one.

    	  if (this.eat(types.semi) || this.insertSemicolon()) { node.argument = null; }
    	  else { node.argument = this.parseExpression(); this.semicolon(); }
    	  return this.finishNode(node, "ReturnStatement")
    	};

    	pp$1.parseSwitchStatement = function(node) {
    	  this.next();
    	  node.discriminant = this.parseParenExpression();
    	  node.cases = [];
    	  this.expect(types.braceL);
    	  this.labels.push(switchLabel);
    	  this.enterScope(0);

    	  // Statements under must be grouped (by label) in SwitchCase
    	  // nodes. `cur` is used to keep the node that we are currently
    	  // adding statements to.

    	  var cur;
    	  for (var sawDefault = false; this.type !== types.braceR;) {
    	    if (this.type === types._case || this.type === types._default) {
    	      var isCase = this.type === types._case;
    	      if (cur) { this.finishNode(cur, "SwitchCase"); }
    	      node.cases.push(cur = this.startNode());
    	      cur.consequent = [];
    	      this.next();
    	      if (isCase) {
    	        cur.test = this.parseExpression();
    	      } else {
    	        if (sawDefault) { this.raiseRecoverable(this.lastTokStart, "Multiple default clauses"); }
    	        sawDefault = true;
    	        cur.test = null;
    	      }
    	      this.expect(types.colon);
    	    } else {
    	      if (!cur) { this.unexpected(); }
    	      cur.consequent.push(this.parseStatement(null));
    	    }
    	  }
    	  this.exitScope();
    	  if (cur) { this.finishNode(cur, "SwitchCase"); }
    	  this.next(); // Closing brace
    	  this.labels.pop();
    	  return this.finishNode(node, "SwitchStatement")
    	};

    	pp$1.parseThrowStatement = function(node) {
    	  this.next();
    	  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
    	    { this.raise(this.lastTokEnd, "Illegal newline after throw"); }
    	  node.argument = this.parseExpression();
    	  this.semicolon();
    	  return this.finishNode(node, "ThrowStatement")
    	};

    	// Reused empty array added for node fields that are always empty.

    	var empty = [];

    	pp$1.parseTryStatement = function(node) {
    	  this.next();
    	  node.block = this.parseBlock();
    	  node.handler = null;
    	  if (this.type === types._catch) {
    	    var clause = this.startNode();
    	    this.next();
    	    if (this.eat(types.parenL)) {
    	      clause.param = this.parseBindingAtom();
    	      var simple = clause.param.type === "Identifier";
    	      this.enterScope(simple ? SCOPE_SIMPLE_CATCH : 0);
    	      this.checkLVal(clause.param, simple ? BIND_SIMPLE_CATCH : BIND_LEXICAL);
    	      this.expect(types.parenR);
    	    } else {
    	      if (this.options.ecmaVersion < 10) { this.unexpected(); }
    	      clause.param = null;
    	      this.enterScope(0);
    	    }
    	    clause.body = this.parseBlock(false);
    	    this.exitScope();
    	    node.handler = this.finishNode(clause, "CatchClause");
    	  }
    	  node.finalizer = this.eat(types._finally) ? this.parseBlock() : null;
    	  if (!node.handler && !node.finalizer)
    	    { this.raise(node.start, "Missing catch or finally clause"); }
    	  return this.finishNode(node, "TryStatement")
    	};

    	pp$1.parseVarStatement = function(node, kind) {
    	  this.next();
    	  this.parseVar(node, false, kind);
    	  this.semicolon();
    	  return this.finishNode(node, "VariableDeclaration")
    	};

    	pp$1.parseWhileStatement = function(node) {
    	  this.next();
    	  node.test = this.parseParenExpression();
    	  this.labels.push(loopLabel);
    	  node.body = this.parseStatement("while");
    	  this.labels.pop();
    	  return this.finishNode(node, "WhileStatement")
    	};

    	pp$1.parseWithStatement = function(node) {
    	  if (this.strict) { this.raise(this.start, "'with' in strict mode"); }
    	  this.next();
    	  node.object = this.parseParenExpression();
    	  node.body = this.parseStatement("with");
    	  return this.finishNode(node, "WithStatement")
    	};

    	pp$1.parseEmptyStatement = function(node) {
    	  this.next();
    	  return this.finishNode(node, "EmptyStatement")
    	};

    	pp$1.parseLabeledStatement = function(node, maybeName, expr, context) {
    	  for (var i$1 = 0, list = this.labels; i$1 < list.length; i$1 += 1)
    	    {
    	    var label = list[i$1];

    	    if (label.name === maybeName)
    	      { this.raise(expr.start, "Label '" + maybeName + "' is already declared");
    	  } }
    	  var kind = this.type.isLoop ? "loop" : this.type === types._switch ? "switch" : null;
    	  for (var i = this.labels.length - 1; i >= 0; i--) {
    	    var label$1 = this.labels[i];
    	    if (label$1.statementStart === node.start) {
    	      // Update information about previous labels on this node
    	      label$1.statementStart = this.start;
    	      label$1.kind = kind;
    	    } else { break }
    	  }
    	  this.labels.push({name: maybeName, kind: kind, statementStart: this.start});
    	  node.body = this.parseStatement(context ? context.indexOf("label") === -1 ? context + "label" : context : "label");
    	  this.labels.pop();
    	  node.label = expr;
    	  return this.finishNode(node, "LabeledStatement")
    	};

    	pp$1.parseExpressionStatement = function(node, expr) {
    	  node.expression = expr;
    	  this.semicolon();
    	  return this.finishNode(node, "ExpressionStatement")
    	};

    	// Parse a semicolon-enclosed block of statements, handling `"use
    	// strict"` declarations when `allowStrict` is true (used for
    	// function bodies).

    	pp$1.parseBlock = function(createNewLexicalScope, node) {
    	  if ( createNewLexicalScope === void 0 ) createNewLexicalScope = true;
    	  if ( node === void 0 ) node = this.startNode();

    	  node.body = [];
    	  this.expect(types.braceL);
    	  if (createNewLexicalScope) { this.enterScope(0); }
    	  while (!this.eat(types.braceR)) {
    	    var stmt = this.parseStatement(null);
    	    node.body.push(stmt);
    	  }
    	  if (createNewLexicalScope) { this.exitScope(); }
    	  return this.finishNode(node, "BlockStatement")
    	};

    	// Parse a regular `for` loop. The disambiguation code in
    	// `parseStatement` will already have parsed the init statement or
    	// expression.

    	pp$1.parseFor = function(node, init) {
    	  node.init = init;
    	  this.expect(types.semi);
    	  node.test = this.type === types.semi ? null : this.parseExpression();
    	  this.expect(types.semi);
    	  node.update = this.type === types.parenR ? null : this.parseExpression();
    	  this.expect(types.parenR);
    	  node.body = this.parseStatement("for");
    	  this.exitScope();
    	  this.labels.pop();
    	  return this.finishNode(node, "ForStatement")
    	};

    	// Parse a `for`/`in` and `for`/`of` loop, which are almost
    	// same from parser's perspective.

    	pp$1.parseForIn = function(node, init) {
    	  var isForIn = this.type === types._in;
    	  this.next();

    	  if (
    	    init.type === "VariableDeclaration" &&
    	    init.declarations[0].init != null &&
    	    (
    	      !isForIn ||
    	      this.options.ecmaVersion < 8 ||
    	      this.strict ||
    	      init.kind !== "var" ||
    	      init.declarations[0].id.type !== "Identifier"
    	    )
    	  ) {
    	    this.raise(
    	      init.start,
    	      ((isForIn ? "for-in" : "for-of") + " loop variable declaration may not have an initializer")
    	    );
    	  } else if (init.type === "AssignmentPattern") {
    	    this.raise(init.start, "Invalid left-hand side in for-loop");
    	  }
    	  node.left = init;
    	  node.right = isForIn ? this.parseExpression() : this.parseMaybeAssign();
    	  this.expect(types.parenR);
    	  node.body = this.parseStatement("for");
    	  this.exitScope();
    	  this.labels.pop();
    	  return this.finishNode(node, isForIn ? "ForInStatement" : "ForOfStatement")
    	};

    	// Parse a list of variable declarations.

    	pp$1.parseVar = function(node, isFor, kind) {
    	  node.declarations = [];
    	  node.kind = kind;
    	  for (;;) {
    	    var decl = this.startNode();
    	    this.parseVarId(decl, kind);
    	    if (this.eat(types.eq)) {
    	      decl.init = this.parseMaybeAssign(isFor);
    	    } else if (kind === "const" && !(this.type === types._in || (this.options.ecmaVersion >= 6 && this.isContextual("of")))) {
    	      this.unexpected();
    	    } else if (decl.id.type !== "Identifier" && !(isFor && (this.type === types._in || this.isContextual("of")))) {
    	      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    	    } else {
    	      decl.init = null;
    	    }
    	    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    	    if (!this.eat(types.comma)) { break }
    	  }
    	  return node
    	};

    	pp$1.parseVarId = function(decl, kind) {
    	  decl.id = this.parseBindingAtom();
    	  this.checkLVal(decl.id, kind === "var" ? BIND_VAR : BIND_LEXICAL, false);
    	};

    	var FUNC_STATEMENT = 1, FUNC_HANGING_STATEMENT = 2, FUNC_NULLABLE_ID = 4;

    	// Parse a function declaration or literal (depending on the
    	// `statement & FUNC_STATEMENT`).

    	// Remove `allowExpressionBody` for 7.0.0, as it is only called with false
    	pp$1.parseFunction = function(node, statement, allowExpressionBody, isAsync) {
    	  this.initFunction(node);
    	  if (this.options.ecmaVersion >= 9 || this.options.ecmaVersion >= 6 && !isAsync) {
    	    if (this.type === types.star && (statement & FUNC_HANGING_STATEMENT))
    	      { this.unexpected(); }
    	    node.generator = this.eat(types.star);
    	  }
    	  if (this.options.ecmaVersion >= 8)
    	    { node.async = !!isAsync; }

    	  if (statement & FUNC_STATEMENT) {
    	    node.id = (statement & FUNC_NULLABLE_ID) && this.type !== types.name ? null : this.parseIdent();
    	    if (node.id && !(statement & FUNC_HANGING_STATEMENT))
    	      // If it is a regular function declaration in sloppy mode, then it is
    	      // subject to Annex B semantics (BIND_FUNCTION). Otherwise, the binding
    	      // mode depends on properties of the current scope (see
    	      // treatFunctionsAsVar).
    	      { this.checkLVal(node.id, (this.strict || node.generator || node.async) ? this.treatFunctionsAsVar ? BIND_VAR : BIND_LEXICAL : BIND_FUNCTION); }
    	  }

    	  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    	  this.yieldPos = 0;
    	  this.awaitPos = 0;
    	  this.awaitIdentPos = 0;
    	  this.enterScope(functionFlags(node.async, node.generator));

    	  if (!(statement & FUNC_STATEMENT))
    	    { node.id = this.type === types.name ? this.parseIdent() : null; }

    	  this.parseFunctionParams(node);
    	  this.parseFunctionBody(node, allowExpressionBody, false);

    	  this.yieldPos = oldYieldPos;
    	  this.awaitPos = oldAwaitPos;
    	  this.awaitIdentPos = oldAwaitIdentPos;
    	  return this.finishNode(node, (statement & FUNC_STATEMENT) ? "FunctionDeclaration" : "FunctionExpression")
    	};

    	pp$1.parseFunctionParams = function(node) {
    	  this.expect(types.parenL);
    	  node.params = this.parseBindingList(types.parenR, false, this.options.ecmaVersion >= 8);
    	  this.checkYieldAwaitInDefaultParams();
    	};

    	// Parse a class declaration or literal (depending on the
    	// `isStatement` parameter).

    	pp$1.parseClass = function(node, isStatement) {
    	  this.next();

    	  // ecma-262 14.6 Class Definitions
    	  // A class definition is always strict mode code.
    	  var oldStrict = this.strict;
    	  this.strict = true;

    	  this.parseClassId(node, isStatement);
    	  this.parseClassSuper(node);
    	  var classBody = this.startNode();
    	  var hadConstructor = false;
    	  classBody.body = [];
    	  this.expect(types.braceL);
    	  while (!this.eat(types.braceR)) {
    	    var element = this.parseClassElement(node.superClass !== null);
    	    if (element) {
    	      classBody.body.push(element);
    	      if (element.type === "MethodDefinition" && element.kind === "constructor") {
    	        if (hadConstructor) { this.raise(element.start, "Duplicate constructor in the same class"); }
    	        hadConstructor = true;
    	      }
    	    }
    	  }
    	  node.body = this.finishNode(classBody, "ClassBody");
    	  this.strict = oldStrict;
    	  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
    	};

    	pp$1.parseClassElement = function(constructorAllowsSuper) {
    	  var this$1 = this;

    	  if (this.eat(types.semi)) { return null }

    	  var method = this.startNode();
    	  var tryContextual = function (k, noLineBreak) {
    	    if ( noLineBreak === void 0 ) noLineBreak = false;

    	    var start = this$1.start, startLoc = this$1.startLoc;
    	    if (!this$1.eatContextual(k)) { return false }
    	    if (this$1.type !== types.parenL && (!noLineBreak || !this$1.canInsertSemicolon())) { return true }
    	    if (method.key) { this$1.unexpected(); }
    	    method.computed = false;
    	    method.key = this$1.startNodeAt(start, startLoc);
    	    method.key.name = k;
    	    this$1.finishNode(method.key, "Identifier");
    	    return false
    	  };

    	  method.kind = "method";
    	  method.static = tryContextual("static");
    	  var isGenerator = this.eat(types.star);
    	  var isAsync = false;
    	  if (!isGenerator) {
    	    if (this.options.ecmaVersion >= 8 && tryContextual("async", true)) {
    	      isAsync = true;
    	      isGenerator = this.options.ecmaVersion >= 9 && this.eat(types.star);
    	    } else if (tryContextual("get")) {
    	      method.kind = "get";
    	    } else if (tryContextual("set")) {
    	      method.kind = "set";
    	    }
    	  }
    	  if (!method.key) { this.parsePropertyName(method); }
    	  var key = method.key;
    	  var allowsDirectSuper = false;
    	  if (!method.computed && !method.static && (key.type === "Identifier" && key.name === "constructor" ||
    	      key.type === "Literal" && key.value === "constructor")) {
    	    if (method.kind !== "method") { this.raise(key.start, "Constructor can't have get/set modifier"); }
    	    if (isGenerator) { this.raise(key.start, "Constructor can't be a generator"); }
    	    if (isAsync) { this.raise(key.start, "Constructor can't be an async method"); }
    	    method.kind = "constructor";
    	    allowsDirectSuper = constructorAllowsSuper;
    	  } else if (method.static && key.type === "Identifier" && key.name === "prototype") {
    	    this.raise(key.start, "Classes may not have a static property named prototype");
    	  }
    	  this.parseClassMethod(method, isGenerator, isAsync, allowsDirectSuper);
    	  if (method.kind === "get" && method.value.params.length !== 0)
    	    { this.raiseRecoverable(method.value.start, "getter should have no params"); }
    	  if (method.kind === "set" && method.value.params.length !== 1)
    	    { this.raiseRecoverable(method.value.start, "setter should have exactly one param"); }
    	  if (method.kind === "set" && method.value.params[0].type === "RestElement")
    	    { this.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params"); }
    	  return method
    	};

    	pp$1.parseClassMethod = function(method, isGenerator, isAsync, allowsDirectSuper) {
    	  method.value = this.parseMethod(isGenerator, isAsync, allowsDirectSuper);
    	  return this.finishNode(method, "MethodDefinition")
    	};

    	pp$1.parseClassId = function(node, isStatement) {
    	  if (this.type === types.name) {
    	    node.id = this.parseIdent();
    	    if (isStatement)
    	      { this.checkLVal(node.id, BIND_LEXICAL, false); }
    	  } else {
    	    if (isStatement === true)
    	      { this.unexpected(); }
    	    node.id = null;
    	  }
    	};

    	pp$1.parseClassSuper = function(node) {
    	  node.superClass = this.eat(types._extends) ? this.parseExprSubscripts() : null;
    	};

    	// Parses module export declaration.

    	pp$1.parseExport = function(node, exports) {
    	  this.next();
    	  // export * from '...'
    	  if (this.eat(types.star)) {
    	    this.expectContextual("from");
    	    if (this.type !== types.string) { this.unexpected(); }
    	    node.source = this.parseExprAtom();
    	    this.semicolon();
    	    return this.finishNode(node, "ExportAllDeclaration")
    	  }
    	  if (this.eat(types._default)) { // export default ...
    	    this.checkExport(exports, "default", this.lastTokStart);
    	    var isAsync;
    	    if (this.type === types._function || (isAsync = this.isAsyncFunction())) {
    	      var fNode = this.startNode();
    	      this.next();
    	      if (isAsync) { this.next(); }
    	      node.declaration = this.parseFunction(fNode, FUNC_STATEMENT | FUNC_NULLABLE_ID, false, isAsync);
    	    } else if (this.type === types._class) {
    	      var cNode = this.startNode();
    	      node.declaration = this.parseClass(cNode, "nullableID");
    	    } else {
    	      node.declaration = this.parseMaybeAssign();
    	      this.semicolon();
    	    }
    	    return this.finishNode(node, "ExportDefaultDeclaration")
    	  }
    	  // export var|const|let|function|class ...
    	  if (this.shouldParseExportStatement()) {
    	    node.declaration = this.parseStatement(null);
    	    if (node.declaration.type === "VariableDeclaration")
    	      { this.checkVariableExport(exports, node.declaration.declarations); }
    	    else
    	      { this.checkExport(exports, node.declaration.id.name, node.declaration.id.start); }
    	    node.specifiers = [];
    	    node.source = null;
    	  } else { // export { x, y as z } [from '...']
    	    node.declaration = null;
    	    node.specifiers = this.parseExportSpecifiers(exports);
    	    if (this.eatContextual("from")) {
    	      if (this.type !== types.string) { this.unexpected(); }
    	      node.source = this.parseExprAtom();
    	    } else {
    	      for (var i = 0, list = node.specifiers; i < list.length; i += 1) {
    	        // check for keywords used as local names
    	        var spec = list[i];

    	        this.checkUnreserved(spec.local);
    	        // check if export is defined
    	        this.checkLocalExport(spec.local);
    	      }

    	      node.source = null;
    	    }
    	    this.semicolon();
    	  }
    	  return this.finishNode(node, "ExportNamedDeclaration")
    	};

    	pp$1.checkExport = function(exports, name, pos) {
    	  if (!exports) { return }
    	  if (has(exports, name))
    	    { this.raiseRecoverable(pos, "Duplicate export '" + name + "'"); }
    	  exports[name] = true;
    	};

    	pp$1.checkPatternExport = function(exports, pat) {
    	  var type = pat.type;
    	  if (type === "Identifier")
    	    { this.checkExport(exports, pat.name, pat.start); }
    	  else if (type === "ObjectPattern")
    	    { for (var i = 0, list = pat.properties; i < list.length; i += 1)
    	      {
    	        var prop = list[i];

    	        this.checkPatternExport(exports, prop);
    	      } }
    	  else if (type === "ArrayPattern")
    	    { for (var i$1 = 0, list$1 = pat.elements; i$1 < list$1.length; i$1 += 1) {
    	      var elt = list$1[i$1];

    	        if (elt) { this.checkPatternExport(exports, elt); }
    	    } }
    	  else if (type === "Property")
    	    { this.checkPatternExport(exports, pat.value); }
    	  else if (type === "AssignmentPattern")
    	    { this.checkPatternExport(exports, pat.left); }
    	  else if (type === "RestElement")
    	    { this.checkPatternExport(exports, pat.argument); }
    	  else if (type === "ParenthesizedExpression")
    	    { this.checkPatternExport(exports, pat.expression); }
    	};

    	pp$1.checkVariableExport = function(exports, decls) {
    	  if (!exports) { return }
    	  for (var i = 0, list = decls; i < list.length; i += 1)
    	    {
    	    var decl = list[i];

    	    this.checkPatternExport(exports, decl.id);
    	  }
    	};

    	pp$1.shouldParseExportStatement = function() {
    	  return this.type.keyword === "var" ||
    	    this.type.keyword === "const" ||
    	    this.type.keyword === "class" ||
    	    this.type.keyword === "function" ||
    	    this.isLet() ||
    	    this.isAsyncFunction()
    	};

    	// Parses a comma-separated list of module exports.

    	pp$1.parseExportSpecifiers = function(exports) {
    	  var nodes = [], first = true;
    	  // export { x, y as z } [from '...']
    	  this.expect(types.braceL);
    	  while (!this.eat(types.braceR)) {
    	    if (!first) {
    	      this.expect(types.comma);
    	      if (this.afterTrailingComma(types.braceR)) { break }
    	    } else { first = false; }

    	    var node = this.startNode();
    	    node.local = this.parseIdent(true);
    	    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
    	    this.checkExport(exports, node.exported.name, node.exported.start);
    	    nodes.push(this.finishNode(node, "ExportSpecifier"));
    	  }
    	  return nodes
    	};

    	// Parses import declaration.

    	pp$1.parseImport = function(node) {
    	  this.next();
    	  // import '...'
    	  if (this.type === types.string) {
    	    node.specifiers = empty;
    	    node.source = this.parseExprAtom();
    	  } else {
    	    node.specifiers = this.parseImportSpecifiers();
    	    this.expectContextual("from");
    	    node.source = this.type === types.string ? this.parseExprAtom() : this.unexpected();
    	  }
    	  this.semicolon();
    	  return this.finishNode(node, "ImportDeclaration")
    	};

    	// Parses a comma-separated list of module imports.

    	pp$1.parseImportSpecifiers = function() {
    	  var nodes = [], first = true;
    	  if (this.type === types.name) {
    	    // import defaultObj, { x, y as z } from '...'
    	    var node = this.startNode();
    	    node.local = this.parseIdent();
    	    this.checkLVal(node.local, BIND_LEXICAL);
    	    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
    	    if (!this.eat(types.comma)) { return nodes }
    	  }
    	  if (this.type === types.star) {
    	    var node$1 = this.startNode();
    	    this.next();
    	    this.expectContextual("as");
    	    node$1.local = this.parseIdent();
    	    this.checkLVal(node$1.local, BIND_LEXICAL);
    	    nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"));
    	    return nodes
    	  }
    	  this.expect(types.braceL);
    	  while (!this.eat(types.braceR)) {
    	    if (!first) {
    	      this.expect(types.comma);
    	      if (this.afterTrailingComma(types.braceR)) { break }
    	    } else { first = false; }

    	    var node$2 = this.startNode();
    	    node$2.imported = this.parseIdent(true);
    	    if (this.eatContextual("as")) {
    	      node$2.local = this.parseIdent();
    	    } else {
    	      this.checkUnreserved(node$2.imported);
    	      node$2.local = node$2.imported;
    	    }
    	    this.checkLVal(node$2.local, BIND_LEXICAL);
    	    nodes.push(this.finishNode(node$2, "ImportSpecifier"));
    	  }
    	  return nodes
    	};

    	// Set `ExpressionStatement#directive` property for directive prologues.
    	pp$1.adaptDirectivePrologue = function(statements) {
    	  for (var i = 0; i < statements.length && this.isDirectiveCandidate(statements[i]); ++i) {
    	    statements[i].directive = statements[i].expression.raw.slice(1, -1);
    	  }
    	};
    	pp$1.isDirectiveCandidate = function(statement) {
    	  return (
    	    statement.type === "ExpressionStatement" &&
    	    statement.expression.type === "Literal" &&
    	    typeof statement.expression.value === "string" &&
    	    // Reject parenthesized strings.
    	    (this.input[statement.start] === "\"" || this.input[statement.start] === "'")
    	  )
    	};

    	var pp$2 = Parser.prototype;

    	// Convert existing expression atom to assignable pattern
    	// if possible.

    	pp$2.toAssignable = function(node, isBinding, refDestructuringErrors) {
    	  if (this.options.ecmaVersion >= 6 && node) {
    	    switch (node.type) {
    	    case "Identifier":
    	      if (this.inAsync && node.name === "await")
    	        { this.raise(node.start, "Cannot use 'await' as identifier inside an async function"); }
    	      break

    	    case "ObjectPattern":
    	    case "ArrayPattern":
    	    case "RestElement":
    	      break

    	    case "ObjectExpression":
    	      node.type = "ObjectPattern";
    	      if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
    	      for (var i = 0, list = node.properties; i < list.length; i += 1) {
    	        var prop = list[i];

    	      this.toAssignable(prop, isBinding);
    	        // Early error:
    	        //   AssignmentRestProperty[Yield, Await] :
    	        //     `...` DestructuringAssignmentTarget[Yield, Await]
    	        //
    	        //   It is a Syntax Error if |DestructuringAssignmentTarget| is an |ArrayLiteral| or an |ObjectLiteral|.
    	        if (
    	          prop.type === "RestElement" &&
    	          (prop.argument.type === "ArrayPattern" || prop.argument.type === "ObjectPattern")
    	        ) {
    	          this.raise(prop.argument.start, "Unexpected token");
    	        }
    	      }
    	      break

    	    case "Property":
    	      // AssignmentProperty has type === "Property"
    	      if (node.kind !== "init") { this.raise(node.key.start, "Object pattern can't contain getter or setter"); }
    	      this.toAssignable(node.value, isBinding);
    	      break

    	    case "ArrayExpression":
    	      node.type = "ArrayPattern";
    	      if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
    	      this.toAssignableList(node.elements, isBinding);
    	      break

    	    case "SpreadElement":
    	      node.type = "RestElement";
    	      this.toAssignable(node.argument, isBinding);
    	      if (node.argument.type === "AssignmentPattern")
    	        { this.raise(node.argument.start, "Rest elements cannot have a default value"); }
    	      break

    	    case "AssignmentExpression":
    	      if (node.operator !== "=") { this.raise(node.left.end, "Only '=' operator can be used for specifying default value."); }
    	      node.type = "AssignmentPattern";
    	      delete node.operator;
    	      this.toAssignable(node.left, isBinding);
    	      // falls through to AssignmentPattern

    	    case "AssignmentPattern":
    	      break

    	    case "ParenthesizedExpression":
    	      this.toAssignable(node.expression, isBinding, refDestructuringErrors);
    	      break

    	    case "MemberExpression":
    	      if (!isBinding) { break }

    	    default:
    	      this.raise(node.start, "Assigning to rvalue");
    	    }
    	  } else if (refDestructuringErrors) { this.checkPatternErrors(refDestructuringErrors, true); }
    	  return node
    	};

    	// Convert list of expression atoms to binding list.

    	pp$2.toAssignableList = function(exprList, isBinding) {
    	  var end = exprList.length;
    	  for (var i = 0; i < end; i++) {
    	    var elt = exprList[i];
    	    if (elt) { this.toAssignable(elt, isBinding); }
    	  }
    	  if (end) {
    	    var last = exprList[end - 1];
    	    if (this.options.ecmaVersion === 6 && isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier")
    	      { this.unexpected(last.argument.start); }
    	  }
    	  return exprList
    	};

    	// Parses spread element.

    	pp$2.parseSpread = function(refDestructuringErrors) {
    	  var node = this.startNode();
    	  this.next();
    	  node.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    	  return this.finishNode(node, "SpreadElement")
    	};

    	pp$2.parseRestBinding = function() {
    	  var node = this.startNode();
    	  this.next();

    	  // RestElement inside of a function parameter must be an identifier
    	  if (this.options.ecmaVersion === 6 && this.type !== types.name)
    	    { this.unexpected(); }

    	  node.argument = this.parseBindingAtom();

    	  return this.finishNode(node, "RestElement")
    	};

    	// Parses lvalue (assignable) atom.

    	pp$2.parseBindingAtom = function() {
    	  if (this.options.ecmaVersion >= 6) {
    	    switch (this.type) {
    	    case types.bracketL:
    	      var node = this.startNode();
    	      this.next();
    	      node.elements = this.parseBindingList(types.bracketR, true, true);
    	      return this.finishNode(node, "ArrayPattern")

    	    case types.braceL:
    	      return this.parseObj(true)
    	    }
    	  }
    	  return this.parseIdent()
    	};

    	pp$2.parseBindingList = function(close, allowEmpty, allowTrailingComma) {
    	  var elts = [], first = true;
    	  while (!this.eat(close)) {
    	    if (first) { first = false; }
    	    else { this.expect(types.comma); }
    	    if (allowEmpty && this.type === types.comma) {
    	      elts.push(null);
    	    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
    	      break
    	    } else if (this.type === types.ellipsis) {
    	      var rest = this.parseRestBinding();
    	      this.parseBindingListItem(rest);
    	      elts.push(rest);
    	      if (this.type === types.comma) { this.raise(this.start, "Comma is not permitted after the rest element"); }
    	      this.expect(close);
    	      break
    	    } else {
    	      var elem = this.parseMaybeDefault(this.start, this.startLoc);
    	      this.parseBindingListItem(elem);
    	      elts.push(elem);
    	    }
    	  }
    	  return elts
    	};

    	pp$2.parseBindingListItem = function(param) {
    	  return param
    	};

    	// Parses assignment pattern around given atom if possible.

    	pp$2.parseMaybeDefault = function(startPos, startLoc, left) {
    	  left = left || this.parseBindingAtom();
    	  if (this.options.ecmaVersion < 6 || !this.eat(types.eq)) { return left }
    	  var node = this.startNodeAt(startPos, startLoc);
    	  node.left = left;
    	  node.right = this.parseMaybeAssign();
    	  return this.finishNode(node, "AssignmentPattern")
    	};

    	// Verify that a node is an lval — something that can be assigned
    	// to.
    	// bindingType can be either:
    	// 'var' indicating that the lval creates a 'var' binding
    	// 'let' indicating that the lval creates a lexical ('let' or 'const') binding
    	// 'none' indicating that the binding should be checked for illegal identifiers, but not for duplicate references

    	pp$2.checkLVal = function(expr, bindingType, checkClashes) {
    	  if ( bindingType === void 0 ) bindingType = BIND_NONE;

    	  switch (expr.type) {
    	  case "Identifier":
    	    if (bindingType === BIND_LEXICAL && expr.name === "let")
    	      { this.raiseRecoverable(expr.start, "let is disallowed as a lexically bound name"); }
    	    if (this.strict && this.reservedWordsStrictBind.test(expr.name))
    	      { this.raiseRecoverable(expr.start, (bindingType ? "Binding " : "Assigning to ") + expr.name + " in strict mode"); }
    	    if (checkClashes) {
    	      if (has(checkClashes, expr.name))
    	        { this.raiseRecoverable(expr.start, "Argument name clash"); }
    	      checkClashes[expr.name] = true;
    	    }
    	    if (bindingType !== BIND_NONE && bindingType !== BIND_OUTSIDE) { this.declareName(expr.name, bindingType, expr.start); }
    	    break

    	  case "MemberExpression":
    	    if (bindingType) { this.raiseRecoverable(expr.start, "Binding member expression"); }
    	    break

    	  case "ObjectPattern":
    	    for (var i = 0, list = expr.properties; i < list.length; i += 1)
    	      {
    	    var prop = list[i];

    	    this.checkLVal(prop, bindingType, checkClashes);
    	  }
    	    break

    	  case "Property":
    	    // AssignmentProperty has type === "Property"
    	    this.checkLVal(expr.value, bindingType, checkClashes);
    	    break

    	  case "ArrayPattern":
    	    for (var i$1 = 0, list$1 = expr.elements; i$1 < list$1.length; i$1 += 1) {
    	      var elem = list$1[i$1];

    	    if (elem) { this.checkLVal(elem, bindingType, checkClashes); }
    	    }
    	    break

    	  case "AssignmentPattern":
    	    this.checkLVal(expr.left, bindingType, checkClashes);
    	    break

    	  case "RestElement":
    	    this.checkLVal(expr.argument, bindingType, checkClashes);
    	    break

    	  case "ParenthesizedExpression":
    	    this.checkLVal(expr.expression, bindingType, checkClashes);
    	    break

    	  default:
    	    this.raise(expr.start, (bindingType ? "Binding" : "Assigning to") + " rvalue");
    	  }
    	};

    	// A recursive descent parser operates by defining functions for all

    	var pp$3 = Parser.prototype;

    	// Check if property name clashes with already added.
    	// Object/class getters and setters are not allowed to clash —
    	// either with each other or with an init property — and in
    	// strict mode, init properties are also not allowed to be repeated.

    	pp$3.checkPropClash = function(prop, propHash, refDestructuringErrors) {
    	  if (this.options.ecmaVersion >= 9 && prop.type === "SpreadElement")
    	    { return }
    	  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
    	    { return }
    	  var key = prop.key;
    	  var name;
    	  switch (key.type) {
    	  case "Identifier": name = key.name; break
    	  case "Literal": name = String(key.value); break
    	  default: return
    	  }
    	  var kind = prop.kind;
    	  if (this.options.ecmaVersion >= 6) {
    	    if (name === "__proto__" && kind === "init") {
    	      if (propHash.proto) {
    	        if (refDestructuringErrors && refDestructuringErrors.doubleProto < 0) { refDestructuringErrors.doubleProto = key.start; }
    	        // Backwards-compat kludge. Can be removed in version 6.0
    	        else { this.raiseRecoverable(key.start, "Redefinition of __proto__ property"); }
    	      }
    	      propHash.proto = true;
    	    }
    	    return
    	  }
    	  name = "$" + name;
    	  var other = propHash[name];
    	  if (other) {
    	    var redefinition;
    	    if (kind === "init") {
    	      redefinition = this.strict && other.init || other.get || other.set;
    	    } else {
    	      redefinition = other.init || other[kind];
    	    }
    	    if (redefinition)
    	      { this.raiseRecoverable(key.start, "Redefinition of property"); }
    	  } else {
    	    other = propHash[name] = {
    	      init: false,
    	      get: false,
    	      set: false
    	    };
    	  }
    	  other[kind] = true;
    	};

    	// ### Expression parsing

    	// These nest, from the most general expression type at the top to
    	// 'atomic', nondivisible expression types at the bottom. Most of
    	// the functions will simply let the function(s) below them parse,
    	// and, *if* the syntactic construct they handle is present, wrap
    	// the AST node that the inner parser gave them in another node.

    	// Parse a full expression. The optional arguments are used to
    	// forbid the `in` operator (in for loops initalization expressions)
    	// and provide reference for storing '=' operator inside shorthand
    	// property assignment in contexts where both object expression
    	// and object pattern might appear (so it's possible to raise
    	// delayed syntax error at correct position).

    	pp$3.parseExpression = function(noIn, refDestructuringErrors) {
    	  var startPos = this.start, startLoc = this.startLoc;
    	  var expr = this.parseMaybeAssign(noIn, refDestructuringErrors);
    	  if (this.type === types.comma) {
    	    var node = this.startNodeAt(startPos, startLoc);
    	    node.expressions = [expr];
    	    while (this.eat(types.comma)) { node.expressions.push(this.parseMaybeAssign(noIn, refDestructuringErrors)); }
    	    return this.finishNode(node, "SequenceExpression")
    	  }
    	  return expr
    	};

    	// Parse an assignment expression. This includes applications of
    	// operators like `+=`.

    	pp$3.parseMaybeAssign = function(noIn, refDestructuringErrors, afterLeftParse) {
    	  if (this.isContextual("yield")) {
    	    if (this.inGenerator) { return this.parseYield(noIn) }
    	    // The tokenizer will assume an expression is allowed after
    	    // `yield`, but this isn't that kind of yield
    	    else { this.exprAllowed = false; }
    	  }

    	  var ownDestructuringErrors = false, oldParenAssign = -1, oldTrailingComma = -1, oldShorthandAssign = -1;
    	  if (refDestructuringErrors) {
    	    oldParenAssign = refDestructuringErrors.parenthesizedAssign;
    	    oldTrailingComma = refDestructuringErrors.trailingComma;
    	    oldShorthandAssign = refDestructuringErrors.shorthandAssign;
    	    refDestructuringErrors.parenthesizedAssign = refDestructuringErrors.trailingComma = refDestructuringErrors.shorthandAssign = -1;
    	  } else {
    	    refDestructuringErrors = new DestructuringErrors;
    	    ownDestructuringErrors = true;
    	  }

    	  var startPos = this.start, startLoc = this.startLoc;
    	  if (this.type === types.parenL || this.type === types.name)
    	    { this.potentialArrowAt = this.start; }
    	  var left = this.parseMaybeConditional(noIn, refDestructuringErrors);
    	  if (afterLeftParse) { left = afterLeftParse.call(this, left, startPos, startLoc); }
    	  if (this.type.isAssign) {
    	    var node = this.startNodeAt(startPos, startLoc);
    	    node.operator = this.value;
    	    node.left = this.type === types.eq ? this.toAssignable(left, false, refDestructuringErrors) : left;
    	    if (!ownDestructuringErrors) { DestructuringErrors.call(refDestructuringErrors); }
    	    refDestructuringErrors.shorthandAssign = -1; // reset because shorthand default was used correctly
    	    this.checkLVal(left);
    	    this.next();
    	    node.right = this.parseMaybeAssign(noIn);
    	    return this.finishNode(node, "AssignmentExpression")
    	  } else {
    	    if (ownDestructuringErrors) { this.checkExpressionErrors(refDestructuringErrors, true); }
    	  }
    	  if (oldParenAssign > -1) { refDestructuringErrors.parenthesizedAssign = oldParenAssign; }
    	  if (oldTrailingComma > -1) { refDestructuringErrors.trailingComma = oldTrailingComma; }
    	  if (oldShorthandAssign > -1) { refDestructuringErrors.shorthandAssign = oldShorthandAssign; }
    	  return left
    	};

    	// Parse a ternary conditional (`?:`) operator.

    	pp$3.parseMaybeConditional = function(noIn, refDestructuringErrors) {
    	  var startPos = this.start, startLoc = this.startLoc;
    	  var expr = this.parseExprOps(noIn, refDestructuringErrors);
    	  if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
    	  if (this.eat(types.question)) {
    	    var node = this.startNodeAt(startPos, startLoc);
    	    node.test = expr;
    	    node.consequent = this.parseMaybeAssign();
    	    this.expect(types.colon);
    	    node.alternate = this.parseMaybeAssign(noIn);
    	    return this.finishNode(node, "ConditionalExpression")
    	  }
    	  return expr
    	};

    	// Start the precedence parser.

    	pp$3.parseExprOps = function(noIn, refDestructuringErrors) {
    	  var startPos = this.start, startLoc = this.startLoc;
    	  var expr = this.parseMaybeUnary(refDestructuringErrors, false);
    	  if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
    	  return expr.start === startPos && expr.type === "ArrowFunctionExpression" ? expr : this.parseExprOp(expr, startPos, startLoc, -1, noIn)
    	};

    	// Parse binary operators with the operator precedence parsing
    	// algorithm. `left` is the left-hand side of the operator.
    	// `minPrec` provides context that allows the function to stop and
    	// defer further parser to one of its callers when it encounters an
    	// operator that has a lower precedence than the set it is parsing.

    	pp$3.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, noIn) {
    	  var prec = this.type.binop;
    	  if (prec != null && (!noIn || this.type !== types._in)) {
    	    if (prec > minPrec) {
    	      var logical = this.type === types.logicalOR || this.type === types.logicalAND;
    	      var op = this.value;
    	      this.next();
    	      var startPos = this.start, startLoc = this.startLoc;
    	      var right = this.parseExprOp(this.parseMaybeUnary(null, false), startPos, startLoc, prec, noIn);
    	      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical);
    	      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn)
    	    }
    	  }
    	  return left
    	};

    	pp$3.buildBinary = function(startPos, startLoc, left, right, op, logical) {
    	  var node = this.startNodeAt(startPos, startLoc);
    	  node.left = left;
    	  node.operator = op;
    	  node.right = right;
    	  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression")
    	};

    	// Parse unary operators, both prefix and postfix.

    	pp$3.parseMaybeUnary = function(refDestructuringErrors, sawUnary) {
    	  var startPos = this.start, startLoc = this.startLoc, expr;
    	  if (this.isContextual("await") && (this.inAsync || (!this.inFunction && this.options.allowAwaitOutsideFunction))) {
    	    expr = this.parseAwait();
    	    sawUnary = true;
    	  } else if (this.type.prefix) {
    	    var node = this.startNode(), update = this.type === types.incDec;
    	    node.operator = this.value;
    	    node.prefix = true;
    	    this.next();
    	    node.argument = this.parseMaybeUnary(null, true);
    	    this.checkExpressionErrors(refDestructuringErrors, true);
    	    if (update) { this.checkLVal(node.argument); }
    	    else if (this.strict && node.operator === "delete" &&
    	             node.argument.type === "Identifier")
    	      { this.raiseRecoverable(node.start, "Deleting local variable in strict mode"); }
    	    else { sawUnary = true; }
    	    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
    	  } else {
    	    expr = this.parseExprSubscripts(refDestructuringErrors);
    	    if (this.checkExpressionErrors(refDestructuringErrors)) { return expr }
    	    while (this.type.postfix && !this.canInsertSemicolon()) {
    	      var node$1 = this.startNodeAt(startPos, startLoc);
    	      node$1.operator = this.value;
    	      node$1.prefix = false;
    	      node$1.argument = expr;
    	      this.checkLVal(expr);
    	      this.next();
    	      expr = this.finishNode(node$1, "UpdateExpression");
    	    }
    	  }

    	  if (!sawUnary && this.eat(types.starstar))
    	    { return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false), "**", false) }
    	  else
    	    { return expr }
    	};

    	// Parse call, dot, and `[]`-subscript expressions.

    	pp$3.parseExprSubscripts = function(refDestructuringErrors) {
    	  var startPos = this.start, startLoc = this.startLoc;
    	  var expr = this.parseExprAtom(refDestructuringErrors);
    	  var skipArrowSubscripts = expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")";
    	  if (this.checkExpressionErrors(refDestructuringErrors) || skipArrowSubscripts) { return expr }
    	  var result = this.parseSubscripts(expr, startPos, startLoc);
    	  if (refDestructuringErrors && result.type === "MemberExpression") {
    	    if (refDestructuringErrors.parenthesizedAssign >= result.start) { refDestructuringErrors.parenthesizedAssign = -1; }
    	    if (refDestructuringErrors.parenthesizedBind >= result.start) { refDestructuringErrors.parenthesizedBind = -1; }
    	  }
    	  return result
    	};

    	pp$3.parseSubscripts = function(base, startPos, startLoc, noCalls) {
    	  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" &&
    	      this.lastTokEnd === base.end && !this.canInsertSemicolon() && this.input.slice(base.start, base.end) === "async";
    	  while (true) {
    	    var element = this.parseSubscript(base, startPos, startLoc, noCalls, maybeAsyncArrow);
    	    if (element === base || element.type === "ArrowFunctionExpression") { return element }
    	    base = element;
    	  }
    	};

    	pp$3.parseSubscript = function(base, startPos, startLoc, noCalls, maybeAsyncArrow) {
    	  var computed = this.eat(types.bracketL);
    	  if (computed || this.eat(types.dot)) {
    	    var node = this.startNodeAt(startPos, startLoc);
    	    node.object = base;
    	    node.property = computed ? this.parseExpression() : this.parseIdent(this.options.allowReserved !== "never");
    	    node.computed = !!computed;
    	    if (computed) { this.expect(types.bracketR); }
    	    base = this.finishNode(node, "MemberExpression");
    	  } else if (!noCalls && this.eat(types.parenL)) {
    	    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;
    	    this.yieldPos = 0;
    	    this.awaitPos = 0;
    	    this.awaitIdentPos = 0;
    	    var exprList = this.parseExprList(types.parenR, this.options.ecmaVersion >= 8, false, refDestructuringErrors);
    	    if (maybeAsyncArrow && !this.canInsertSemicolon() && this.eat(types.arrow)) {
    	      this.checkPatternErrors(refDestructuringErrors, false);
    	      this.checkYieldAwaitInDefaultParams();
    	      if (this.awaitIdentPos > 0)
    	        { this.raise(this.awaitIdentPos, "Cannot use 'await' as identifier inside an async function"); }
    	      this.yieldPos = oldYieldPos;
    	      this.awaitPos = oldAwaitPos;
    	      this.awaitIdentPos = oldAwaitIdentPos;
    	      return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList, true)
    	    }
    	    this.checkExpressionErrors(refDestructuringErrors, true);
    	    this.yieldPos = oldYieldPos || this.yieldPos;
    	    this.awaitPos = oldAwaitPos || this.awaitPos;
    	    this.awaitIdentPos = oldAwaitIdentPos || this.awaitIdentPos;
    	    var node$1 = this.startNodeAt(startPos, startLoc);
    	    node$1.callee = base;
    	    node$1.arguments = exprList;
    	    base = this.finishNode(node$1, "CallExpression");
    	  } else if (this.type === types.backQuote) {
    	    var node$2 = this.startNodeAt(startPos, startLoc);
    	    node$2.tag = base;
    	    node$2.quasi = this.parseTemplate({isTagged: true});
    	    base = this.finishNode(node$2, "TaggedTemplateExpression");
    	  }
    	  return base
    	};

    	// Parse an atomic expression — either a single token that is an
    	// expression, an expression started by a keyword like `function` or
    	// `new`, or an expression wrapped in punctuation like `()`, `[]`,
    	// or `{}`.

    	pp$3.parseExprAtom = function(refDestructuringErrors) {
    	  // If a division operator appears in an expression position, the
    	  // tokenizer got confused, and we force it to read a regexp instead.
    	  if (this.type === types.slash) { this.readRegexp(); }

    	  var node, canBeArrow = this.potentialArrowAt === this.start;
    	  switch (this.type) {
    	  case types._super:
    	    if (!this.allowSuper)
    	      { this.raise(this.start, "'super' keyword outside a method"); }
    	    node = this.startNode();
    	    this.next();
    	    if (this.type === types.parenL && !this.allowDirectSuper)
    	      { this.raise(node.start, "super() call outside constructor of a subclass"); }
    	    // The `super` keyword can appear at below:
    	    // SuperProperty:
    	    //     super [ Expression ]
    	    //     super . IdentifierName
    	    // SuperCall:
    	    //     super ( Arguments )
    	    if (this.type !== types.dot && this.type !== types.bracketL && this.type !== types.parenL)
    	      { this.unexpected(); }
    	    return this.finishNode(node, "Super")

    	  case types._this:
    	    node = this.startNode();
    	    this.next();
    	    return this.finishNode(node, "ThisExpression")

    	  case types.name:
    	    var startPos = this.start, startLoc = this.startLoc, containsEsc = this.containsEsc;
    	    var id = this.parseIdent(false);
    	    if (this.options.ecmaVersion >= 8 && !containsEsc && id.name === "async" && !this.canInsertSemicolon() && this.eat(types._function))
    	      { return this.parseFunction(this.startNodeAt(startPos, startLoc), 0, false, true) }
    	    if (canBeArrow && !this.canInsertSemicolon()) {
    	      if (this.eat(types.arrow))
    	        { return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false) }
    	      if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === types.name && !containsEsc) {
    	        id = this.parseIdent(false);
    	        if (this.canInsertSemicolon() || !this.eat(types.arrow))
    	          { this.unexpected(); }
    	        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true)
    	      }
    	    }
    	    return id

    	  case types.regexp:
    	    var value = this.value;
    	    node = this.parseLiteral(value.value);
    	    node.regex = {pattern: value.pattern, flags: value.flags};
    	    return node

    	  case types.num: case types.string:
    	    return this.parseLiteral(this.value)

    	  case types._null: case types._true: case types._false:
    	    node = this.startNode();
    	    node.value = this.type === types._null ? null : this.type === types._true;
    	    node.raw = this.type.keyword;
    	    this.next();
    	    return this.finishNode(node, "Literal")

    	  case types.parenL:
    	    var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow);
    	    if (refDestructuringErrors) {
    	      if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))
    	        { refDestructuringErrors.parenthesizedAssign = start; }
    	      if (refDestructuringErrors.parenthesizedBind < 0)
    	        { refDestructuringErrors.parenthesizedBind = start; }
    	    }
    	    return expr

    	  case types.bracketL:
    	    node = this.startNode();
    	    this.next();
    	    node.elements = this.parseExprList(types.bracketR, true, true, refDestructuringErrors);
    	    return this.finishNode(node, "ArrayExpression")

    	  case types.braceL:
    	    return this.parseObj(false, refDestructuringErrors)

    	  case types._function:
    	    node = this.startNode();
    	    this.next();
    	    return this.parseFunction(node, 0)

    	  case types._class:
    	    return this.parseClass(this.startNode(), false)

    	  case types._new:
    	    return this.parseNew()

    	  case types.backQuote:
    	    return this.parseTemplate()

    	  case types._import:
    	    if (this.options.ecmaVersion >= 11) {
    	      return this.parseExprImport()
    	    } else {
    	      return this.unexpected()
    	    }

    	  default:
    	    this.unexpected();
    	  }
    	};

    	pp$3.parseExprImport = function() {
    	  var node = this.startNode();
    	  this.next(); // skip `import`
    	  switch (this.type) {
    	  case types.parenL:
    	    return this.parseDynamicImport(node)
    	  default:
    	    this.unexpected();
    	  }
    	};

    	pp$3.parseDynamicImport = function(node) {
    	  this.next(); // skip `(`

    	  // Parse node.source.
    	  node.source = this.parseMaybeAssign();

    	  // Verify ending.
    	  if (!this.eat(types.parenR)) {
    	    var errorPos = this.start;
    	    if (this.eat(types.comma) && this.eat(types.parenR)) {
    	      this.raiseRecoverable(errorPos, "Trailing comma is not allowed in import()");
    	    } else {
    	      this.unexpected(errorPos);
    	    }
    	  }

    	  return this.finishNode(node, "ImportExpression")
    	};

    	pp$3.parseLiteral = function(value) {
    	  var node = this.startNode();
    	  node.value = value;
    	  node.raw = this.input.slice(this.start, this.end);
    	  if (node.raw.charCodeAt(node.raw.length - 1) === 110) { node.bigint = node.raw.slice(0, -1); }
    	  this.next();
    	  return this.finishNode(node, "Literal")
    	};

    	pp$3.parseParenExpression = function() {
    	  this.expect(types.parenL);
    	  var val = this.parseExpression();
    	  this.expect(types.parenR);
    	  return val
    	};

    	pp$3.parseParenAndDistinguishExpression = function(canBeArrow) {
    	  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8;
    	  if (this.options.ecmaVersion >= 6) {
    	    this.next();

    	    var innerStartPos = this.start, innerStartLoc = this.startLoc;
    	    var exprList = [], first = true, lastIsComma = false;
    	    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart;
    	    this.yieldPos = 0;
    	    this.awaitPos = 0;
    	    // Do not save awaitIdentPos to allow checking awaits nested in parameters
    	    while (this.type !== types.parenR) {
    	      first ? first = false : this.expect(types.comma);
    	      if (allowTrailingComma && this.afterTrailingComma(types.parenR, true)) {
    	        lastIsComma = true;
    	        break
    	      } else if (this.type === types.ellipsis) {
    	        spreadStart = this.start;
    	        exprList.push(this.parseParenItem(this.parseRestBinding()));
    	        if (this.type === types.comma) { this.raise(this.start, "Comma is not permitted after the rest element"); }
    	        break
    	      } else {
    	        exprList.push(this.parseMaybeAssign(false, refDestructuringErrors, this.parseParenItem));
    	      }
    	    }
    	    var innerEndPos = this.start, innerEndLoc = this.startLoc;
    	    this.expect(types.parenR);

    	    if (canBeArrow && !this.canInsertSemicolon() && this.eat(types.arrow)) {
    	      this.checkPatternErrors(refDestructuringErrors, false);
    	      this.checkYieldAwaitInDefaultParams();
    	      this.yieldPos = oldYieldPos;
    	      this.awaitPos = oldAwaitPos;
    	      return this.parseParenArrowList(startPos, startLoc, exprList)
    	    }

    	    if (!exprList.length || lastIsComma) { this.unexpected(this.lastTokStart); }
    	    if (spreadStart) { this.unexpected(spreadStart); }
    	    this.checkExpressionErrors(refDestructuringErrors, true);
    	    this.yieldPos = oldYieldPos || this.yieldPos;
    	    this.awaitPos = oldAwaitPos || this.awaitPos;

    	    if (exprList.length > 1) {
    	      val = this.startNodeAt(innerStartPos, innerStartLoc);
    	      val.expressions = exprList;
    	      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    	    } else {
    	      val = exprList[0];
    	    }
    	  } else {
    	    val = this.parseParenExpression();
    	  }

    	  if (this.options.preserveParens) {
    	    var par = this.startNodeAt(startPos, startLoc);
    	    par.expression = val;
    	    return this.finishNode(par, "ParenthesizedExpression")
    	  } else {
    	    return val
    	  }
    	};

    	pp$3.parseParenItem = function(item) {
    	  return item
    	};

    	pp$3.parseParenArrowList = function(startPos, startLoc, exprList) {
    	  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList)
    	};

    	// New's precedence is slightly tricky. It must allow its argument to
    	// be a `[]` or dot subscript expression, but not a call — at least,
    	// not without wrapping it in parentheses. Thus, it uses the noCalls
    	// argument to parseSubscripts to prevent it from consuming the
    	// argument list.

    	var empty$1 = [];

    	pp$3.parseNew = function() {
    	  var node = this.startNode();
    	  var meta = this.parseIdent(true);
    	  if (this.options.ecmaVersion >= 6 && this.eat(types.dot)) {
    	    node.meta = meta;
    	    var containsEsc = this.containsEsc;
    	    node.property = this.parseIdent(true);
    	    if (node.property.name !== "target" || containsEsc)
    	      { this.raiseRecoverable(node.property.start, "The only valid meta property for new is new.target"); }
    	    if (!this.inNonArrowFunction())
    	      { this.raiseRecoverable(node.start, "new.target can only be used in functions"); }
    	    return this.finishNode(node, "MetaProperty")
    	  }
    	  var startPos = this.start, startLoc = this.startLoc, isImport = this.type === types._import;
    	  node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
    	  if (isImport && node.callee.type === "ImportExpression") {
    	    this.raise(startPos, "Cannot use new with import()");
    	  }
    	  if (this.eat(types.parenL)) { node.arguments = this.parseExprList(types.parenR, this.options.ecmaVersion >= 8, false); }
    	  else { node.arguments = empty$1; }
    	  return this.finishNode(node, "NewExpression")
    	};

    	// Parse template expression.

    	pp$3.parseTemplateElement = function(ref) {
    	  var isTagged = ref.isTagged;

    	  var elem = this.startNode();
    	  if (this.type === types.invalidTemplate) {
    	    if (!isTagged) {
    	      this.raiseRecoverable(this.start, "Bad escape sequence in untagged template literal");
    	    }
    	    elem.value = {
    	      raw: this.value,
    	      cooked: null
    	    };
    	  } else {
    	    elem.value = {
    	      raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
    	      cooked: this.value
    	    };
    	  }
    	  this.next();
    	  elem.tail = this.type === types.backQuote;
    	  return this.finishNode(elem, "TemplateElement")
    	};

    	pp$3.parseTemplate = function(ref) {
    	  if ( ref === void 0 ) ref = {};
    	  var isTagged = ref.isTagged; if ( isTagged === void 0 ) isTagged = false;

    	  var node = this.startNode();
    	  this.next();
    	  node.expressions = [];
    	  var curElt = this.parseTemplateElement({isTagged: isTagged});
    	  node.quasis = [curElt];
    	  while (!curElt.tail) {
    	    if (this.type === types.eof) { this.raise(this.pos, "Unterminated template literal"); }
    	    this.expect(types.dollarBraceL);
    	    node.expressions.push(this.parseExpression());
    	    this.expect(types.braceR);
    	    node.quasis.push(curElt = this.parseTemplateElement({isTagged: isTagged}));
    	  }
    	  this.next();
    	  return this.finishNode(node, "TemplateLiteral")
    	};

    	pp$3.isAsyncProp = function(prop) {
    	  return !prop.computed && prop.key.type === "Identifier" && prop.key.name === "async" &&
    	    (this.type === types.name || this.type === types.num || this.type === types.string || this.type === types.bracketL || this.type.keyword || (this.options.ecmaVersion >= 9 && this.type === types.star)) &&
    	    !lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
    	};

    	// Parse an object literal or binding pattern.

    	pp$3.parseObj = function(isPattern, refDestructuringErrors) {
    	  var node = this.startNode(), first = true, propHash = {};
    	  node.properties = [];
    	  this.next();
    	  while (!this.eat(types.braceR)) {
    	    if (!first) {
    	      this.expect(types.comma);
    	      if (this.options.ecmaVersion >= 5 && this.afterTrailingComma(types.braceR)) { break }
    	    } else { first = false; }

    	    var prop = this.parseProperty(isPattern, refDestructuringErrors);
    	    if (!isPattern) { this.checkPropClash(prop, propHash, refDestructuringErrors); }
    	    node.properties.push(prop);
    	  }
    	  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression")
    	};

    	pp$3.parseProperty = function(isPattern, refDestructuringErrors) {
    	  var prop = this.startNode(), isGenerator, isAsync, startPos, startLoc;
    	  if (this.options.ecmaVersion >= 9 && this.eat(types.ellipsis)) {
    	    if (isPattern) {
    	      prop.argument = this.parseIdent(false);
    	      if (this.type === types.comma) {
    	        this.raise(this.start, "Comma is not permitted after the rest element");
    	      }
    	      return this.finishNode(prop, "RestElement")
    	    }
    	    // To disallow parenthesized identifier via `this.toAssignable()`.
    	    if (this.type === types.parenL && refDestructuringErrors) {
    	      if (refDestructuringErrors.parenthesizedAssign < 0) {
    	        refDestructuringErrors.parenthesizedAssign = this.start;
    	      }
    	      if (refDestructuringErrors.parenthesizedBind < 0) {
    	        refDestructuringErrors.parenthesizedBind = this.start;
    	      }
    	    }
    	    // Parse argument.
    	    prop.argument = this.parseMaybeAssign(false, refDestructuringErrors);
    	    // To disallow trailing comma via `this.toAssignable()`.
    	    if (this.type === types.comma && refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
    	      refDestructuringErrors.trailingComma = this.start;
    	    }
    	    // Finish
    	    return this.finishNode(prop, "SpreadElement")
    	  }
    	  if (this.options.ecmaVersion >= 6) {
    	    prop.method = false;
    	    prop.shorthand = false;
    	    if (isPattern || refDestructuringErrors) {
    	      startPos = this.start;
    	      startLoc = this.startLoc;
    	    }
    	    if (!isPattern)
    	      { isGenerator = this.eat(types.star); }
    	  }
    	  var containsEsc = this.containsEsc;
    	  this.parsePropertyName(prop);
    	  if (!isPattern && !containsEsc && this.options.ecmaVersion >= 8 && !isGenerator && this.isAsyncProp(prop)) {
    	    isAsync = true;
    	    isGenerator = this.options.ecmaVersion >= 9 && this.eat(types.star);
    	    this.parsePropertyName(prop, refDestructuringErrors);
    	  } else {
    	    isAsync = false;
    	  }
    	  this.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc);
    	  return this.finishNode(prop, "Property")
    	};

    	pp$3.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors, containsEsc) {
    	  if ((isGenerator || isAsync) && this.type === types.colon)
    	    { this.unexpected(); }

    	  if (this.eat(types.colon)) {
    	    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors);
    	    prop.kind = "init";
    	  } else if (this.options.ecmaVersion >= 6 && this.type === types.parenL) {
    	    if (isPattern) { this.unexpected(); }
    	    prop.kind = "init";
    	    prop.method = true;
    	    prop.value = this.parseMethod(isGenerator, isAsync);
    	  } else if (!isPattern && !containsEsc &&
    	             this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" &&
    	             (prop.key.name === "get" || prop.key.name === "set") &&
    	             (this.type !== types.comma && this.type !== types.braceR)) {
    	    if (isGenerator || isAsync) { this.unexpected(); }
    	    prop.kind = prop.key.name;
    	    this.parsePropertyName(prop);
    	    prop.value = this.parseMethod(false);
    	    var paramCount = prop.kind === "get" ? 0 : 1;
    	    if (prop.value.params.length !== paramCount) {
    	      var start = prop.value.start;
    	      if (prop.kind === "get")
    	        { this.raiseRecoverable(start, "getter should have no params"); }
    	      else
    	        { this.raiseRecoverable(start, "setter should have exactly one param"); }
    	    } else {
    	      if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
    	        { this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params"); }
    	    }
    	  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    	    if (isGenerator || isAsync) { this.unexpected(); }
    	    this.checkUnreserved(prop.key);
    	    if (prop.key.name === "await" && !this.awaitIdentPos)
    	      { this.awaitIdentPos = startPos; }
    	    prop.kind = "init";
    	    if (isPattern) {
    	      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
    	    } else if (this.type === types.eq && refDestructuringErrors) {
    	      if (refDestructuringErrors.shorthandAssign < 0)
    	        { refDestructuringErrors.shorthandAssign = this.start; }
    	      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
    	    } else {
    	      prop.value = prop.key;
    	    }
    	    prop.shorthand = true;
    	  } else { this.unexpected(); }
    	};

    	pp$3.parsePropertyName = function(prop) {
    	  if (this.options.ecmaVersion >= 6) {
    	    if (this.eat(types.bracketL)) {
    	      prop.computed = true;
    	      prop.key = this.parseMaybeAssign();
    	      this.expect(types.bracketR);
    	      return prop.key
    	    } else {
    	      prop.computed = false;
    	    }
    	  }
    	  return prop.key = this.type === types.num || this.type === types.string ? this.parseExprAtom() : this.parseIdent(this.options.allowReserved !== "never")
    	};

    	// Initialize empty function node.

    	pp$3.initFunction = function(node) {
    	  node.id = null;
    	  if (this.options.ecmaVersion >= 6) { node.generator = node.expression = false; }
    	  if (this.options.ecmaVersion >= 8) { node.async = false; }
    	};

    	// Parse object or class method.

    	pp$3.parseMethod = function(isGenerator, isAsync, allowDirectSuper) {
    	  var node = this.startNode(), oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

    	  this.initFunction(node);
    	  if (this.options.ecmaVersion >= 6)
    	    { node.generator = isGenerator; }
    	  if (this.options.ecmaVersion >= 8)
    	    { node.async = !!isAsync; }

    	  this.yieldPos = 0;
    	  this.awaitPos = 0;
    	  this.awaitIdentPos = 0;
    	  this.enterScope(functionFlags(isAsync, node.generator) | SCOPE_SUPER | (allowDirectSuper ? SCOPE_DIRECT_SUPER : 0));

    	  this.expect(types.parenL);
    	  node.params = this.parseBindingList(types.parenR, false, this.options.ecmaVersion >= 8);
    	  this.checkYieldAwaitInDefaultParams();
    	  this.parseFunctionBody(node, false, true);

    	  this.yieldPos = oldYieldPos;
    	  this.awaitPos = oldAwaitPos;
    	  this.awaitIdentPos = oldAwaitIdentPos;
    	  return this.finishNode(node, "FunctionExpression")
    	};

    	// Parse arrow function expression with given parameters.

    	pp$3.parseArrowExpression = function(node, params, isAsync) {
    	  var oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldAwaitIdentPos = this.awaitIdentPos;

    	  this.enterScope(functionFlags(isAsync, false) | SCOPE_ARROW);
    	  this.initFunction(node);
    	  if (this.options.ecmaVersion >= 8) { node.async = !!isAsync; }

    	  this.yieldPos = 0;
    	  this.awaitPos = 0;
    	  this.awaitIdentPos = 0;

    	  node.params = this.toAssignableList(params, true);
    	  this.parseFunctionBody(node, true, false);

    	  this.yieldPos = oldYieldPos;
    	  this.awaitPos = oldAwaitPos;
    	  this.awaitIdentPos = oldAwaitIdentPos;
    	  return this.finishNode(node, "ArrowFunctionExpression")
    	};

    	// Parse function body and check parameters.

    	pp$3.parseFunctionBody = function(node, isArrowFunction, isMethod) {
    	  var isExpression = isArrowFunction && this.type !== types.braceL;
    	  var oldStrict = this.strict, useStrict = false;

    	  if (isExpression) {
    	    node.body = this.parseMaybeAssign();
    	    node.expression = true;
    	    this.checkParams(node, false);
    	  } else {
    	    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params);
    	    if (!oldStrict || nonSimple) {
    	      useStrict = this.strictDirective(this.end);
    	      // If this is a strict mode function, verify that argument names
    	      // are not repeated, and it does not try to bind the words `eval`
    	      // or `arguments`.
    	      if (useStrict && nonSimple)
    	        { this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list"); }
    	    }
    	    // Start a new scope with regard to labels and the `inFunction`
    	    // flag (restore them to their old value afterwards).
    	    var oldLabels = this.labels;
    	    this.labels = [];
    	    if (useStrict) { this.strict = true; }

    	    // Add the params to varDeclaredNames to ensure that an error is thrown
    	    // if a let/const declaration in the function clashes with one of the params.
    	    this.checkParams(node, !oldStrict && !useStrict && !isArrowFunction && !isMethod && this.isSimpleParamList(node.params));
    	    node.body = this.parseBlock(false);
    	    node.expression = false;
    	    this.adaptDirectivePrologue(node.body.body);
    	    this.labels = oldLabels;
    	  }
    	  this.exitScope();

    	  // Ensure the function name isn't a forbidden identifier in strict mode, e.g. 'eval'
    	  if (this.strict && node.id) { this.checkLVal(node.id, BIND_OUTSIDE); }
    	  this.strict = oldStrict;
    	};

    	pp$3.isSimpleParamList = function(params) {
    	  for (var i = 0, list = params; i < list.length; i += 1)
    	    {
    	    var param = list[i];

    	    if (param.type !== "Identifier") { return false
    	  } }
    	  return true
    	};

    	// Checks function params for various disallowed patterns such as using "eval"
    	// or "arguments" and duplicate parameters.

    	pp$3.checkParams = function(node, allowDuplicates) {
    	  var nameHash = {};
    	  for (var i = 0, list = node.params; i < list.length; i += 1)
    	    {
    	    var param = list[i];

    	    this.checkLVal(param, BIND_VAR, allowDuplicates ? null : nameHash);
    	  }
    	};

    	// Parses a comma-separated list of expressions, and returns them as
    	// an array. `close` is the token type that ends the list, and
    	// `allowEmpty` can be turned on to allow subsequent commas with
    	// nothing in between them to be parsed as `null` (which is needed
    	// for array literals).

    	pp$3.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
    	  var elts = [], first = true;
    	  while (!this.eat(close)) {
    	    if (!first) {
    	      this.expect(types.comma);
    	      if (allowTrailingComma && this.afterTrailingComma(close)) { break }
    	    } else { first = false; }

    	    var elt = (void 0);
    	    if (allowEmpty && this.type === types.comma)
    	      { elt = null; }
    	    else if (this.type === types.ellipsis) {
    	      elt = this.parseSpread(refDestructuringErrors);
    	      if (refDestructuringErrors && this.type === types.comma && refDestructuringErrors.trailingComma < 0)
    	        { refDestructuringErrors.trailingComma = this.start; }
    	    } else {
    	      elt = this.parseMaybeAssign(false, refDestructuringErrors);
    	    }
    	    elts.push(elt);
    	  }
    	  return elts
    	};

    	pp$3.checkUnreserved = function(ref) {
    	  var start = ref.start;
    	  var end = ref.end;
    	  var name = ref.name;

    	  if (this.inGenerator && name === "yield")
    	    { this.raiseRecoverable(start, "Cannot use 'yield' as identifier inside a generator"); }
    	  if (this.inAsync && name === "await")
    	    { this.raiseRecoverable(start, "Cannot use 'await' as identifier inside an async function"); }
    	  if (this.keywords.test(name))
    	    { this.raise(start, ("Unexpected keyword '" + name + "'")); }
    	  if (this.options.ecmaVersion < 6 &&
    	    this.input.slice(start, end).indexOf("\\") !== -1) { return }
    	  var re = this.strict ? this.reservedWordsStrict : this.reservedWords;
    	  if (re.test(name)) {
    	    if (!this.inAsync && name === "await")
    	      { this.raiseRecoverable(start, "Cannot use keyword 'await' outside an async function"); }
    	    this.raiseRecoverable(start, ("The keyword '" + name + "' is reserved"));
    	  }
    	};

    	// Parse the next token as an identifier. If `liberal` is true (used
    	// when parsing properties), it will also convert keywords into
    	// identifiers.

    	pp$3.parseIdent = function(liberal, isBinding) {
    	  var node = this.startNode();
    	  if (this.type === types.name) {
    	    node.name = this.value;
    	  } else if (this.type.keyword) {
    	    node.name = this.type.keyword;

    	    // To fix https://github.com/acornjs/acorn/issues/575
    	    // `class` and `function` keywords push new context into this.context.
    	    // But there is no chance to pop the context if the keyword is consumed as an identifier such as a property name.
    	    // If the previous token is a dot, this does not apply because the context-managing code already ignored the keyword
    	    if ((node.name === "class" || node.name === "function") &&
    	        (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46)) {
    	      this.context.pop();
    	    }
    	  } else {
    	    this.unexpected();
    	  }
    	  this.next();
    	  this.finishNode(node, "Identifier");
    	  if (!liberal) {
    	    this.checkUnreserved(node);
    	    if (node.name === "await" && !this.awaitIdentPos)
    	      { this.awaitIdentPos = node.start; }
    	  }
    	  return node
    	};

    	// Parses yield expression inside generator.

    	pp$3.parseYield = function(noIn) {
    	  if (!this.yieldPos) { this.yieldPos = this.start; }

    	  var node = this.startNode();
    	  this.next();
    	  if (this.type === types.semi || this.canInsertSemicolon() || (this.type !== types.star && !this.type.startsExpr)) {
    	    node.delegate = false;
    	    node.argument = null;
    	  } else {
    	    node.delegate = this.eat(types.star);
    	    node.argument = this.parseMaybeAssign(noIn);
    	  }
    	  return this.finishNode(node, "YieldExpression")
    	};

    	pp$3.parseAwait = function() {
    	  if (!this.awaitPos) { this.awaitPos = this.start; }

    	  var node = this.startNode();
    	  this.next();
    	  node.argument = this.parseMaybeUnary(null, true);
    	  return this.finishNode(node, "AwaitExpression")
    	};

    	var pp$4 = Parser.prototype;

    	// This function is used to raise exceptions on parse errors. It
    	// takes an offset integer (into the current `input`) to indicate
    	// the location of the error, attaches the position to the end
    	// of the error message, and then raises a `SyntaxError` with that
    	// message.

    	pp$4.raise = function(pos, message) {
    	  var loc = getLineInfo(this.input, pos);
    	  message += " (" + loc.line + ":" + loc.column + ")";
    	  var err = new SyntaxError(message);
    	  err.pos = pos; err.loc = loc; err.raisedAt = this.pos;
    	  throw err
    	};

    	pp$4.raiseRecoverable = pp$4.raise;

    	pp$4.curPosition = function() {
    	  if (this.options.locations) {
    	    return new Position(this.curLine, this.pos - this.lineStart)
    	  }
    	};

    	var pp$5 = Parser.prototype;

    	var Scope = function Scope(flags) {
    	  this.flags = flags;
    	  // A list of var-declared names in the current lexical scope
    	  this.var = [];
    	  // A list of lexically-declared names in the current lexical scope
    	  this.lexical = [];
    	  // A list of lexically-declared FunctionDeclaration names in the current lexical scope
    	  this.functions = [];
    	};

    	// The functions in this module keep track of declared variables in the current scope in order to detect duplicate variable names.

    	pp$5.enterScope = function(flags) {
    	  this.scopeStack.push(new Scope(flags));
    	};

    	pp$5.exitScope = function() {
    	  this.scopeStack.pop();
    	};

    	// The spec says:
    	// > At the top level of a function, or script, function declarations are
    	// > treated like var declarations rather than like lexical declarations.
    	pp$5.treatFunctionsAsVarInScope = function(scope) {
    	  return (scope.flags & SCOPE_FUNCTION) || !this.inModule && (scope.flags & SCOPE_TOP)
    	};

    	pp$5.declareName = function(name, bindingType, pos) {
    	  var redeclared = false;
    	  if (bindingType === BIND_LEXICAL) {
    	    var scope = this.currentScope();
    	    redeclared = scope.lexical.indexOf(name) > -1 || scope.functions.indexOf(name) > -1 || scope.var.indexOf(name) > -1;
    	    scope.lexical.push(name);
    	    if (this.inModule && (scope.flags & SCOPE_TOP))
    	      { delete this.undefinedExports[name]; }
    	  } else if (bindingType === BIND_SIMPLE_CATCH) {
    	    var scope$1 = this.currentScope();
    	    scope$1.lexical.push(name);
    	  } else if (bindingType === BIND_FUNCTION) {
    	    var scope$2 = this.currentScope();
    	    if (this.treatFunctionsAsVar)
    	      { redeclared = scope$2.lexical.indexOf(name) > -1; }
    	    else
    	      { redeclared = scope$2.lexical.indexOf(name) > -1 || scope$2.var.indexOf(name) > -1; }
    	    scope$2.functions.push(name);
    	  } else {
    	    for (var i = this.scopeStack.length - 1; i >= 0; --i) {
    	      var scope$3 = this.scopeStack[i];
    	      if (scope$3.lexical.indexOf(name) > -1 && !((scope$3.flags & SCOPE_SIMPLE_CATCH) && scope$3.lexical[0] === name) ||
    	          !this.treatFunctionsAsVarInScope(scope$3) && scope$3.functions.indexOf(name) > -1) {
    	        redeclared = true;
    	        break
    	      }
    	      scope$3.var.push(name);
    	      if (this.inModule && (scope$3.flags & SCOPE_TOP))
    	        { delete this.undefinedExports[name]; }
    	      if (scope$3.flags & SCOPE_VAR) { break }
    	    }
    	  }
    	  if (redeclared) { this.raiseRecoverable(pos, ("Identifier '" + name + "' has already been declared")); }
    	};

    	pp$5.checkLocalExport = function(id) {
    	  // scope.functions must be empty as Module code is always strict.
    	  if (this.scopeStack[0].lexical.indexOf(id.name) === -1 &&
    	      this.scopeStack[0].var.indexOf(id.name) === -1) {
    	    this.undefinedExports[id.name] = id;
    	  }
    	};

    	pp$5.currentScope = function() {
    	  return this.scopeStack[this.scopeStack.length - 1]
    	};

    	pp$5.currentVarScope = function() {
    	  for (var i = this.scopeStack.length - 1;; i--) {
    	    var scope = this.scopeStack[i];
    	    if (scope.flags & SCOPE_VAR) { return scope }
    	  }
    	};

    	// Could be useful for `this`, `new.target`, `super()`, `super.property`, and `super[property]`.
    	pp$5.currentThisScope = function() {
    	  for (var i = this.scopeStack.length - 1;; i--) {
    	    var scope = this.scopeStack[i];
    	    if (scope.flags & SCOPE_VAR && !(scope.flags & SCOPE_ARROW)) { return scope }
    	  }
    	};

    	var Node = function Node(parser, pos, loc) {
    	  this.type = "";
    	  this.start = pos;
    	  this.end = 0;
    	  if (parser.options.locations)
    	    { this.loc = new SourceLocation(parser, loc); }
    	  if (parser.options.directSourceFile)
    	    { this.sourceFile = parser.options.directSourceFile; }
    	  if (parser.options.ranges)
    	    { this.range = [pos, 0]; }
    	};

    	// Start an AST node, attaching a start offset.

    	var pp$6 = Parser.prototype;

    	pp$6.startNode = function() {
    	  return new Node(this, this.start, this.startLoc)
    	};

    	pp$6.startNodeAt = function(pos, loc) {
    	  return new Node(this, pos, loc)
    	};

    	// Finish an AST node, adding `type` and `end` properties.

    	function finishNodeAt(node, type, pos, loc) {
    	  node.type = type;
    	  node.end = pos;
    	  if (this.options.locations)
    	    { node.loc.end = loc; }
    	  if (this.options.ranges)
    	    { node.range[1] = pos; }
    	  return node
    	}

    	pp$6.finishNode = function(node, type) {
    	  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
    	};

    	// Finish node at given position

    	pp$6.finishNodeAt = function(node, type, pos, loc) {
    	  return finishNodeAt.call(this, node, type, pos, loc)
    	};

    	// The algorithm used to determine whether a regexp can appear at a

    	var TokContext = function TokContext(token, isExpr, preserveSpace, override, generator) {
    	  this.token = token;
    	  this.isExpr = !!isExpr;
    	  this.preserveSpace = !!preserveSpace;
    	  this.override = override;
    	  this.generator = !!generator;
    	};

    	var types$1 = {
    	  b_stat: new TokContext("{", false),
    	  b_expr: new TokContext("{", true),
    	  b_tmpl: new TokContext("${", false),
    	  p_stat: new TokContext("(", false),
    	  p_expr: new TokContext("(", true),
    	  q_tmpl: new TokContext("`", true, true, function (p) { return p.tryReadTemplateToken(); }),
    	  f_stat: new TokContext("function", false),
    	  f_expr: new TokContext("function", true),
    	  f_expr_gen: new TokContext("function", true, false, null, true),
    	  f_gen: new TokContext("function", false, false, null, true)
    	};

    	var pp$7 = Parser.prototype;

    	pp$7.initialContext = function() {
    	  return [types$1.b_stat]
    	};

    	pp$7.braceIsBlock = function(prevType) {
    	  var parent = this.curContext();
    	  if (parent === types$1.f_expr || parent === types$1.f_stat)
    	    { return true }
    	  if (prevType === types.colon && (parent === types$1.b_stat || parent === types$1.b_expr))
    	    { return !parent.isExpr }

    	  // The check for `tt.name && exprAllowed` detects whether we are
    	  // after a `yield` or `of` construct. See the `updateContext` for
    	  // `tt.name`.
    	  if (prevType === types._return || prevType === types.name && this.exprAllowed)
    	    { return lineBreak.test(this.input.slice(this.lastTokEnd, this.start)) }
    	  if (prevType === types._else || prevType === types.semi || prevType === types.eof || prevType === types.parenR || prevType === types.arrow)
    	    { return true }
    	  if (prevType === types.braceL)
    	    { return parent === types$1.b_stat }
    	  if (prevType === types._var || prevType === types._const || prevType === types.name)
    	    { return false }
    	  return !this.exprAllowed
    	};

    	pp$7.inGeneratorContext = function() {
    	  for (var i = this.context.length - 1; i >= 1; i--) {
    	    var context = this.context[i];
    	    if (context.token === "function")
    	      { return context.generator }
    	  }
    	  return false
    	};

    	pp$7.updateContext = function(prevType) {
    	  var update, type = this.type;
    	  if (type.keyword && prevType === types.dot)
    	    { this.exprAllowed = false; }
    	  else if (update = type.updateContext)
    	    { update.call(this, prevType); }
    	  else
    	    { this.exprAllowed = type.beforeExpr; }
    	};

    	// Token-specific context update code

    	types.parenR.updateContext = types.braceR.updateContext = function() {
    	  if (this.context.length === 1) {
    	    this.exprAllowed = true;
    	    return
    	  }
    	  var out = this.context.pop();
    	  if (out === types$1.b_stat && this.curContext().token === "function") {
    	    out = this.context.pop();
    	  }
    	  this.exprAllowed = !out.isExpr;
    	};

    	types.braceL.updateContext = function(prevType) {
    	  this.context.push(this.braceIsBlock(prevType) ? types$1.b_stat : types$1.b_expr);
    	  this.exprAllowed = true;
    	};

    	types.dollarBraceL.updateContext = function() {
    	  this.context.push(types$1.b_tmpl);
    	  this.exprAllowed = true;
    	};

    	types.parenL.updateContext = function(prevType) {
    	  var statementParens = prevType === types._if || prevType === types._for || prevType === types._with || prevType === types._while;
    	  this.context.push(statementParens ? types$1.p_stat : types$1.p_expr);
    	  this.exprAllowed = true;
    	};

    	types.incDec.updateContext = function() {
    	  // tokExprAllowed stays unchanged
    	};

    	types._function.updateContext = types._class.updateContext = function(prevType) {
    	  if (prevType.beforeExpr && prevType !== types.semi && prevType !== types._else &&
    	      !(prevType === types._return && lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) &&
    	      !((prevType === types.colon || prevType === types.braceL) && this.curContext() === types$1.b_stat))
    	    { this.context.push(types$1.f_expr); }
    	  else
    	    { this.context.push(types$1.f_stat); }
    	  this.exprAllowed = false;
    	};

    	types.backQuote.updateContext = function() {
    	  if (this.curContext() === types$1.q_tmpl)
    	    { this.context.pop(); }
    	  else
    	    { this.context.push(types$1.q_tmpl); }
    	  this.exprAllowed = false;
    	};

    	types.star.updateContext = function(prevType) {
    	  if (prevType === types._function) {
    	    var index = this.context.length - 1;
    	    if (this.context[index] === types$1.f_expr)
    	      { this.context[index] = types$1.f_expr_gen; }
    	    else
    	      { this.context[index] = types$1.f_gen; }
    	  }
    	  this.exprAllowed = true;
    	};

    	types.name.updateContext = function(prevType) {
    	  var allowed = false;
    	  if (this.options.ecmaVersion >= 6 && prevType !== types.dot) {
    	    if (this.value === "of" && !this.exprAllowed ||
    	        this.value === "yield" && this.inGeneratorContext())
    	      { allowed = true; }
    	  }
    	  this.exprAllowed = allowed;
    	};

    	// This file contains Unicode properties extracted from the ECMAScript
    	// specification. The lists are extracted like so:
    	// $$('#table-binary-unicode-properties > figure > table > tbody > tr > td:nth-child(1) code').map(el => el.innerText)

    	// #table-binary-unicode-properties
    	var ecma9BinaryProperties = "ASCII ASCII_Hex_Digit AHex Alphabetic Alpha Any Assigned Bidi_Control Bidi_C Bidi_Mirrored Bidi_M Case_Ignorable CI Cased Changes_When_Casefolded CWCF Changes_When_Casemapped CWCM Changes_When_Lowercased CWL Changes_When_NFKC_Casefolded CWKCF Changes_When_Titlecased CWT Changes_When_Uppercased CWU Dash Default_Ignorable_Code_Point DI Deprecated Dep Diacritic Dia Emoji Emoji_Component Emoji_Modifier Emoji_Modifier_Base Emoji_Presentation Extender Ext Grapheme_Base Gr_Base Grapheme_Extend Gr_Ext Hex_Digit Hex IDS_Binary_Operator IDSB IDS_Trinary_Operator IDST ID_Continue IDC ID_Start IDS Ideographic Ideo Join_Control Join_C Logical_Order_Exception LOE Lowercase Lower Math Noncharacter_Code_Point NChar Pattern_Syntax Pat_Syn Pattern_White_Space Pat_WS Quotation_Mark QMark Radical Regional_Indicator RI Sentence_Terminal STerm Soft_Dotted SD Terminal_Punctuation Term Unified_Ideograph UIdeo Uppercase Upper Variation_Selector VS White_Space space XID_Continue XIDC XID_Start XIDS";
    	var ecma10BinaryProperties = ecma9BinaryProperties + " Extended_Pictographic";
    	var ecma11BinaryProperties = ecma10BinaryProperties;
    	var unicodeBinaryProperties = {
    	  9: ecma9BinaryProperties,
    	  10: ecma10BinaryProperties,
    	  11: ecma11BinaryProperties
    	};

    	// #table-unicode-general-category-values
    	var unicodeGeneralCategoryValues = "Cased_Letter LC Close_Punctuation Pe Connector_Punctuation Pc Control Cc cntrl Currency_Symbol Sc Dash_Punctuation Pd Decimal_Number Nd digit Enclosing_Mark Me Final_Punctuation Pf Format Cf Initial_Punctuation Pi Letter L Letter_Number Nl Line_Separator Zl Lowercase_Letter Ll Mark M Combining_Mark Math_Symbol Sm Modifier_Letter Lm Modifier_Symbol Sk Nonspacing_Mark Mn Number N Open_Punctuation Ps Other C Other_Letter Lo Other_Number No Other_Punctuation Po Other_Symbol So Paragraph_Separator Zp Private_Use Co Punctuation P punct Separator Z Space_Separator Zs Spacing_Mark Mc Surrogate Cs Symbol S Titlecase_Letter Lt Unassigned Cn Uppercase_Letter Lu";

    	// #table-unicode-script-values
    	var ecma9ScriptValues = "Adlam Adlm Ahom Ahom Anatolian_Hieroglyphs Hluw Arabic Arab Armenian Armn Avestan Avst Balinese Bali Bamum Bamu Bassa_Vah Bass Batak Batk Bengali Beng Bhaiksuki Bhks Bopomofo Bopo Brahmi Brah Braille Brai Buginese Bugi Buhid Buhd Canadian_Aboriginal Cans Carian Cari Caucasian_Albanian Aghb Chakma Cakm Cham Cham Cherokee Cher Common Zyyy Coptic Copt Qaac Cuneiform Xsux Cypriot Cprt Cyrillic Cyrl Deseret Dsrt Devanagari Deva Duployan Dupl Egyptian_Hieroglyphs Egyp Elbasan Elba Ethiopic Ethi Georgian Geor Glagolitic Glag Gothic Goth Grantha Gran Greek Grek Gujarati Gujr Gurmukhi Guru Han Hani Hangul Hang Hanunoo Hano Hatran Hatr Hebrew Hebr Hiragana Hira Imperial_Aramaic Armi Inherited Zinh Qaai Inscriptional_Pahlavi Phli Inscriptional_Parthian Prti Javanese Java Kaithi Kthi Kannada Knda Katakana Kana Kayah_Li Kali Kharoshthi Khar Khmer Khmr Khojki Khoj Khudawadi Sind Lao Laoo Latin Latn Lepcha Lepc Limbu Limb Linear_A Lina Linear_B Linb Lisu Lisu Lycian Lyci Lydian Lydi Mahajani Mahj Malayalam Mlym Mandaic Mand Manichaean Mani Marchen Marc Masaram_Gondi Gonm Meetei_Mayek Mtei Mende_Kikakui Mend Meroitic_Cursive Merc Meroitic_Hieroglyphs Mero Miao Plrd Modi Modi Mongolian Mong Mro Mroo Multani Mult Myanmar Mymr Nabataean Nbat New_Tai_Lue Talu Newa Newa Nko Nkoo Nushu Nshu Ogham Ogam Ol_Chiki Olck Old_Hungarian Hung Old_Italic Ital Old_North_Arabian Narb Old_Permic Perm Old_Persian Xpeo Old_South_Arabian Sarb Old_Turkic Orkh Oriya Orya Osage Osge Osmanya Osma Pahawh_Hmong Hmng Palmyrene Palm Pau_Cin_Hau Pauc Phags_Pa Phag Phoenician Phnx Psalter_Pahlavi Phlp Rejang Rjng Runic Runr Samaritan Samr Saurashtra Saur Sharada Shrd Shavian Shaw Siddham Sidd SignWriting Sgnw Sinhala Sinh Sora_Sompeng Sora Soyombo Soyo Sundanese Sund Syloti_Nagri Sylo Syriac Syrc Tagalog Tglg Tagbanwa Tagb Tai_Le Tale Tai_Tham Lana Tai_Viet Tavt Takri Takr Tamil Taml Tangut Tang Telugu Telu Thaana Thaa Thai Thai Tibetan Tibt Tifinagh Tfng Tirhuta Tirh Ugaritic Ugar Vai Vaii Warang_Citi Wara Yi Yiii Zanabazar_Square Zanb";
    	var ecma10ScriptValues = ecma9ScriptValues + " Dogra Dogr Gunjala_Gondi Gong Hanifi_Rohingya Rohg Makasar Maka Medefaidrin Medf Old_Sogdian Sogo Sogdian Sogd";
    	var ecma11ScriptValues = ecma10ScriptValues + " Elymaic Elym Nandinagari Nand Nyiakeng_Puachue_Hmong Hmnp Wancho Wcho";
    	var unicodeScriptValues = {
    	  9: ecma9ScriptValues,
    	  10: ecma10ScriptValues,
    	  11: ecma11ScriptValues
    	};

    	var data = {};
    	function buildUnicodeData(ecmaVersion) {
    	  var d = data[ecmaVersion] = {
    	    binary: wordsRegexp(unicodeBinaryProperties[ecmaVersion] + " " + unicodeGeneralCategoryValues),
    	    nonBinary: {
    	      General_Category: wordsRegexp(unicodeGeneralCategoryValues),
    	      Script: wordsRegexp(unicodeScriptValues[ecmaVersion])
    	    }
    	  };
    	  d.nonBinary.Script_Extensions = d.nonBinary.Script;

    	  d.nonBinary.gc = d.nonBinary.General_Category;
    	  d.nonBinary.sc = d.nonBinary.Script;
    	  d.nonBinary.scx = d.nonBinary.Script_Extensions;
    	}
    	buildUnicodeData(9);
    	buildUnicodeData(10);
    	buildUnicodeData(11);

    	var pp$8 = Parser.prototype;

    	var RegExpValidationState = function RegExpValidationState(parser) {
    	  this.parser = parser;
    	  this.validFlags = "gim" + (parser.options.ecmaVersion >= 6 ? "uy" : "") + (parser.options.ecmaVersion >= 9 ? "s" : "");
    	  this.unicodeProperties = data[parser.options.ecmaVersion >= 11 ? 11 : parser.options.ecmaVersion];
    	  this.source = "";
    	  this.flags = "";
    	  this.start = 0;
    	  this.switchU = false;
    	  this.switchN = false;
    	  this.pos = 0;
    	  this.lastIntValue = 0;
    	  this.lastStringValue = "";
    	  this.lastAssertionIsQuantifiable = false;
    	  this.numCapturingParens = 0;
    	  this.maxBackReference = 0;
    	  this.groupNames = [];
    	  this.backReferenceNames = [];
    	};

    	RegExpValidationState.prototype.reset = function reset (start, pattern, flags) {
    	  var unicode = flags.indexOf("u") !== -1;
    	  this.start = start | 0;
    	  this.source = pattern + "";
    	  this.flags = flags;
    	  this.switchU = unicode && this.parser.options.ecmaVersion >= 6;
    	  this.switchN = unicode && this.parser.options.ecmaVersion >= 9;
    	};

    	RegExpValidationState.prototype.raise = function raise (message) {
    	  this.parser.raiseRecoverable(this.start, ("Invalid regular expression: /" + (this.source) + "/: " + message));
    	};

    	// If u flag is given, this returns the code point at the index (it combines a surrogate pair).
    	// Otherwise, this returns the code unit of the index (can be a part of a surrogate pair).
    	RegExpValidationState.prototype.at = function at (i) {
    	  var s = this.source;
    	  var l = s.length;
    	  if (i >= l) {
    	    return -1
    	  }
    	  var c = s.charCodeAt(i);
    	  if (!this.switchU || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l) {
    	    return c
    	  }
    	  return (c << 10) + s.charCodeAt(i + 1) - 0x35FDC00
    	};

    	RegExpValidationState.prototype.nextIndex = function nextIndex (i) {
    	  var s = this.source;
    	  var l = s.length;
    	  if (i >= l) {
    	    return l
    	  }
    	  var c = s.charCodeAt(i);
    	  if (!this.switchU || c <= 0xD7FF || c >= 0xE000 || i + 1 >= l) {
    	    return i + 1
    	  }
    	  return i + 2
    	};

    	RegExpValidationState.prototype.current = function current () {
    	  return this.at(this.pos)
    	};

    	RegExpValidationState.prototype.lookahead = function lookahead () {
    	  return this.at(this.nextIndex(this.pos))
    	};

    	RegExpValidationState.prototype.advance = function advance () {
    	  this.pos = this.nextIndex(this.pos);
    	};

    	RegExpValidationState.prototype.eat = function eat (ch) {
    	  if (this.current() === ch) {
    	    this.advance();
    	    return true
    	  }
    	  return false
    	};

    	function codePointToString(ch) {
    	  if (ch <= 0xFFFF) { return String.fromCharCode(ch) }
    	  ch -= 0x10000;
    	  return String.fromCharCode((ch >> 10) + 0xD800, (ch & 0x03FF) + 0xDC00)
    	}

    	/**
    	 * Validate the flags part of a given RegExpLiteral.
    	 *
    	 * @param {RegExpValidationState} state The state to validate RegExp.
    	 * @returns {void}
    	 */
    	pp$8.validateRegExpFlags = function(state) {
    	  var validFlags = state.validFlags;
    	  var flags = state.flags;

    	  for (var i = 0; i < flags.length; i++) {
    	    var flag = flags.charAt(i);
    	    if (validFlags.indexOf(flag) === -1) {
    	      this.raise(state.start, "Invalid regular expression flag");
    	    }
    	    if (flags.indexOf(flag, i + 1) > -1) {
    	      this.raise(state.start, "Duplicate regular expression flag");
    	    }
    	  }
    	};

    	/**
    	 * Validate the pattern part of a given RegExpLiteral.
    	 *
    	 * @param {RegExpValidationState} state The state to validate RegExp.
    	 * @returns {void}
    	 */
    	pp$8.validateRegExpPattern = function(state) {
    	  this.regexp_pattern(state);

    	  // The goal symbol for the parse is |Pattern[~U, ~N]|. If the result of
    	  // parsing contains a |GroupName|, reparse with the goal symbol
    	  // |Pattern[~U, +N]| and use this result instead. Throw a *SyntaxError*
    	  // exception if _P_ did not conform to the grammar, if any elements of _P_
    	  // were not matched by the parse, or if any Early Error conditions exist.
    	  if (!state.switchN && this.options.ecmaVersion >= 9 && state.groupNames.length > 0) {
    	    state.switchN = true;
    	    this.regexp_pattern(state);
    	  }
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-Pattern
    	pp$8.regexp_pattern = function(state) {
    	  state.pos = 0;
    	  state.lastIntValue = 0;
    	  state.lastStringValue = "";
    	  state.lastAssertionIsQuantifiable = false;
    	  state.numCapturingParens = 0;
    	  state.maxBackReference = 0;
    	  state.groupNames.length = 0;
    	  state.backReferenceNames.length = 0;

    	  this.regexp_disjunction(state);

    	  if (state.pos !== state.source.length) {
    	    // Make the same messages as V8.
    	    if (state.eat(0x29 /* ) */)) {
    	      state.raise("Unmatched ')'");
    	    }
    	    if (state.eat(0x5D /* [ */) || state.eat(0x7D /* } */)) {
    	      state.raise("Lone quantifier brackets");
    	    }
    	  }
    	  if (state.maxBackReference > state.numCapturingParens) {
    	    state.raise("Invalid escape");
    	  }
    	  for (var i = 0, list = state.backReferenceNames; i < list.length; i += 1) {
    	    var name = list[i];

    	    if (state.groupNames.indexOf(name) === -1) {
    	      state.raise("Invalid named capture referenced");
    	    }
    	  }
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-Disjunction
    	pp$8.regexp_disjunction = function(state) {
    	  this.regexp_alternative(state);
    	  while (state.eat(0x7C /* | */)) {
    	    this.regexp_alternative(state);
    	  }

    	  // Make the same message as V8.
    	  if (this.regexp_eatQuantifier(state, true)) {
    	    state.raise("Nothing to repeat");
    	  }
    	  if (state.eat(0x7B /* { */)) {
    	    state.raise("Lone quantifier brackets");
    	  }
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-Alternative
    	pp$8.regexp_alternative = function(state) {
    	  while (state.pos < state.source.length && this.regexp_eatTerm(state))
    	    { }
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Term
    	pp$8.regexp_eatTerm = function(state) {
    	  if (this.regexp_eatAssertion(state)) {
    	    // Handle `QuantifiableAssertion Quantifier` alternative.
    	    // `state.lastAssertionIsQuantifiable` is true if the last eaten Assertion
    	    // is a QuantifiableAssertion.
    	    if (state.lastAssertionIsQuantifiable && this.regexp_eatQuantifier(state)) {
    	      // Make the same message as V8.
    	      if (state.switchU) {
    	        state.raise("Invalid quantifier");
    	      }
    	    }
    	    return true
    	  }

    	  if (state.switchU ? this.regexp_eatAtom(state) : this.regexp_eatExtendedAtom(state)) {
    	    this.regexp_eatQuantifier(state);
    	    return true
    	  }

    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-Assertion
    	pp$8.regexp_eatAssertion = function(state) {
    	  var start = state.pos;
    	  state.lastAssertionIsQuantifiable = false;

    	  // ^, $
    	  if (state.eat(0x5E /* ^ */) || state.eat(0x24 /* $ */)) {
    	    return true
    	  }

    	  // \b \B
    	  if (state.eat(0x5C /* \ */)) {
    	    if (state.eat(0x42 /* B */) || state.eat(0x62 /* b */)) {
    	      return true
    	    }
    	    state.pos = start;
    	  }

    	  // Lookahead / Lookbehind
    	  if (state.eat(0x28 /* ( */) && state.eat(0x3F /* ? */)) {
    	    var lookbehind = false;
    	    if (this.options.ecmaVersion >= 9) {
    	      lookbehind = state.eat(0x3C /* < */);
    	    }
    	    if (state.eat(0x3D /* = */) || state.eat(0x21 /* ! */)) {
    	      this.regexp_disjunction(state);
    	      if (!state.eat(0x29 /* ) */)) {
    	        state.raise("Unterminated group");
    	      }
    	      state.lastAssertionIsQuantifiable = !lookbehind;
    	      return true
    	    }
    	  }

    	  state.pos = start;
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-Quantifier
    	pp$8.regexp_eatQuantifier = function(state, noError) {
    	  if ( noError === void 0 ) noError = false;

    	  if (this.regexp_eatQuantifierPrefix(state, noError)) {
    	    state.eat(0x3F /* ? */);
    	    return true
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-QuantifierPrefix
    	pp$8.regexp_eatQuantifierPrefix = function(state, noError) {
    	  return (
    	    state.eat(0x2A /* * */) ||
    	    state.eat(0x2B /* + */) ||
    	    state.eat(0x3F /* ? */) ||
    	    this.regexp_eatBracedQuantifier(state, noError)
    	  )
    	};
    	pp$8.regexp_eatBracedQuantifier = function(state, noError) {
    	  var start = state.pos;
    	  if (state.eat(0x7B /* { */)) {
    	    var min = 0, max = -1;
    	    if (this.regexp_eatDecimalDigits(state)) {
    	      min = state.lastIntValue;
    	      if (state.eat(0x2C /* , */) && this.regexp_eatDecimalDigits(state)) {
    	        max = state.lastIntValue;
    	      }
    	      if (state.eat(0x7D /* } */)) {
    	        // SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-term
    	        if (max !== -1 && max < min && !noError) {
    	          state.raise("numbers out of order in {} quantifier");
    	        }
    	        return true
    	      }
    	    }
    	    if (state.switchU && !noError) {
    	      state.raise("Incomplete quantifier");
    	    }
    	    state.pos = start;
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-Atom
    	pp$8.regexp_eatAtom = function(state) {
    	  return (
    	    this.regexp_eatPatternCharacters(state) ||
    	    state.eat(0x2E /* . */) ||
    	    this.regexp_eatReverseSolidusAtomEscape(state) ||
    	    this.regexp_eatCharacterClass(state) ||
    	    this.regexp_eatUncapturingGroup(state) ||
    	    this.regexp_eatCapturingGroup(state)
    	  )
    	};
    	pp$8.regexp_eatReverseSolidusAtomEscape = function(state) {
    	  var start = state.pos;
    	  if (state.eat(0x5C /* \ */)) {
    	    if (this.regexp_eatAtomEscape(state)) {
    	      return true
    	    }
    	    state.pos = start;
    	  }
    	  return false
    	};
    	pp$8.regexp_eatUncapturingGroup = function(state) {
    	  var start = state.pos;
    	  if (state.eat(0x28 /* ( */)) {
    	    if (state.eat(0x3F /* ? */) && state.eat(0x3A /* : */)) {
    	      this.regexp_disjunction(state);
    	      if (state.eat(0x29 /* ) */)) {
    	        return true
    	      }
    	      state.raise("Unterminated group");
    	    }
    	    state.pos = start;
    	  }
    	  return false
    	};
    	pp$8.regexp_eatCapturingGroup = function(state) {
    	  if (state.eat(0x28 /* ( */)) {
    	    if (this.options.ecmaVersion >= 9) {
    	      this.regexp_groupSpecifier(state);
    	    } else if (state.current() === 0x3F /* ? */) {
    	      state.raise("Invalid group");
    	    }
    	    this.regexp_disjunction(state);
    	    if (state.eat(0x29 /* ) */)) {
    	      state.numCapturingParens += 1;
    	      return true
    	    }
    	    state.raise("Unterminated group");
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedAtom
    	pp$8.regexp_eatExtendedAtom = function(state) {
    	  return (
    	    state.eat(0x2E /* . */) ||
    	    this.regexp_eatReverseSolidusAtomEscape(state) ||
    	    this.regexp_eatCharacterClass(state) ||
    	    this.regexp_eatUncapturingGroup(state) ||
    	    this.regexp_eatCapturingGroup(state) ||
    	    this.regexp_eatInvalidBracedQuantifier(state) ||
    	    this.regexp_eatExtendedPatternCharacter(state)
    	  )
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-InvalidBracedQuantifier
    	pp$8.regexp_eatInvalidBracedQuantifier = function(state) {
    	  if (this.regexp_eatBracedQuantifier(state, true)) {
    	    state.raise("Nothing to repeat");
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-SyntaxCharacter
    	pp$8.regexp_eatSyntaxCharacter = function(state) {
    	  var ch = state.current();
    	  if (isSyntaxCharacter(ch)) {
    	    state.lastIntValue = ch;
    	    state.advance();
    	    return true
    	  }
    	  return false
    	};
    	function isSyntaxCharacter(ch) {
    	  return (
    	    ch === 0x24 /* $ */ ||
    	    ch >= 0x28 /* ( */ && ch <= 0x2B /* + */ ||
    	    ch === 0x2E /* . */ ||
    	    ch === 0x3F /* ? */ ||
    	    ch >= 0x5B /* [ */ && ch <= 0x5E /* ^ */ ||
    	    ch >= 0x7B /* { */ && ch <= 0x7D /* } */
    	  )
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-PatternCharacter
    	// But eat eager.
    	pp$8.regexp_eatPatternCharacters = function(state) {
    	  var start = state.pos;
    	  var ch = 0;
    	  while ((ch = state.current()) !== -1 && !isSyntaxCharacter(ch)) {
    	    state.advance();
    	  }
    	  return state.pos !== start
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ExtendedPatternCharacter
    	pp$8.regexp_eatExtendedPatternCharacter = function(state) {
    	  var ch = state.current();
    	  if (
    	    ch !== -1 &&
    	    ch !== 0x24 /* $ */ &&
    	    !(ch >= 0x28 /* ( */ && ch <= 0x2B /* + */) &&
    	    ch !== 0x2E /* . */ &&
    	    ch !== 0x3F /* ? */ &&
    	    ch !== 0x5B /* [ */ &&
    	    ch !== 0x5E /* ^ */ &&
    	    ch !== 0x7C /* | */
    	  ) {
    	    state.advance();
    	    return true
    	  }
    	  return false
    	};

    	// GroupSpecifier[U] ::
    	//   [empty]
    	//   `?` GroupName[?U]
    	pp$8.regexp_groupSpecifier = function(state) {
    	  if (state.eat(0x3F /* ? */)) {
    	    if (this.regexp_eatGroupName(state)) {
    	      if (state.groupNames.indexOf(state.lastStringValue) !== -1) {
    	        state.raise("Duplicate capture group name");
    	      }
    	      state.groupNames.push(state.lastStringValue);
    	      return
    	    }
    	    state.raise("Invalid group");
    	  }
    	};

    	// GroupName[U] ::
    	//   `<` RegExpIdentifierName[?U] `>`
    	// Note: this updates `state.lastStringValue` property with the eaten name.
    	pp$8.regexp_eatGroupName = function(state) {
    	  state.lastStringValue = "";
    	  if (state.eat(0x3C /* < */)) {
    	    if (this.regexp_eatRegExpIdentifierName(state) && state.eat(0x3E /* > */)) {
    	      return true
    	    }
    	    state.raise("Invalid capture group name");
    	  }
    	  return false
    	};

    	// RegExpIdentifierName[U] ::
    	//   RegExpIdentifierStart[?U]
    	//   RegExpIdentifierName[?U] RegExpIdentifierPart[?U]
    	// Note: this updates `state.lastStringValue` property with the eaten name.
    	pp$8.regexp_eatRegExpIdentifierName = function(state) {
    	  state.lastStringValue = "";
    	  if (this.regexp_eatRegExpIdentifierStart(state)) {
    	    state.lastStringValue += codePointToString(state.lastIntValue);
    	    while (this.regexp_eatRegExpIdentifierPart(state)) {
    	      state.lastStringValue += codePointToString(state.lastIntValue);
    	    }
    	    return true
    	  }
    	  return false
    	};

    	// RegExpIdentifierStart[U] ::
    	//   UnicodeIDStart
    	//   `$`
    	//   `_`
    	//   `\` RegExpUnicodeEscapeSequence[?U]
    	pp$8.regexp_eatRegExpIdentifierStart = function(state) {
    	  var start = state.pos;
    	  var ch = state.current();
    	  state.advance();

    	  if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state)) {
    	    ch = state.lastIntValue;
    	  }
    	  if (isRegExpIdentifierStart(ch)) {
    	    state.lastIntValue = ch;
    	    return true
    	  }

    	  state.pos = start;
    	  return false
    	};
    	function isRegExpIdentifierStart(ch) {
    	  return isIdentifierStart(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */
    	}

    	// RegExpIdentifierPart[U] ::
    	//   UnicodeIDContinue
    	//   `$`
    	//   `_`
    	//   `\` RegExpUnicodeEscapeSequence[?U]
    	//   <ZWNJ>
    	//   <ZWJ>
    	pp$8.regexp_eatRegExpIdentifierPart = function(state) {
    	  var start = state.pos;
    	  var ch = state.current();
    	  state.advance();

    	  if (ch === 0x5C /* \ */ && this.regexp_eatRegExpUnicodeEscapeSequence(state)) {
    	    ch = state.lastIntValue;
    	  }
    	  if (isRegExpIdentifierPart(ch)) {
    	    state.lastIntValue = ch;
    	    return true
    	  }

    	  state.pos = start;
    	  return false
    	};
    	function isRegExpIdentifierPart(ch) {
    	  return isIdentifierChar(ch, true) || ch === 0x24 /* $ */ || ch === 0x5F /* _ */ || ch === 0x200C /* <ZWNJ> */ || ch === 0x200D /* <ZWJ> */
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-AtomEscape
    	pp$8.regexp_eatAtomEscape = function(state) {
    	  if (
    	    this.regexp_eatBackReference(state) ||
    	    this.regexp_eatCharacterClassEscape(state) ||
    	    this.regexp_eatCharacterEscape(state) ||
    	    (state.switchN && this.regexp_eatKGroupName(state))
    	  ) {
    	    return true
    	  }
    	  if (state.switchU) {
    	    // Make the same message as V8.
    	    if (state.current() === 0x63 /* c */) {
    	      state.raise("Invalid unicode escape");
    	    }
    	    state.raise("Invalid escape");
    	  }
    	  return false
    	};
    	pp$8.regexp_eatBackReference = function(state) {
    	  var start = state.pos;
    	  if (this.regexp_eatDecimalEscape(state)) {
    	    var n = state.lastIntValue;
    	    if (state.switchU) {
    	      // For SyntaxError in https://www.ecma-international.org/ecma-262/8.0/#sec-atomescape
    	      if (n > state.maxBackReference) {
    	        state.maxBackReference = n;
    	      }
    	      return true
    	    }
    	    if (n <= state.numCapturingParens) {
    	      return true
    	    }
    	    state.pos = start;
    	  }
    	  return false
    	};
    	pp$8.regexp_eatKGroupName = function(state) {
    	  if (state.eat(0x6B /* k */)) {
    	    if (this.regexp_eatGroupName(state)) {
    	      state.backReferenceNames.push(state.lastStringValue);
    	      return true
    	    }
    	    state.raise("Invalid named reference");
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-CharacterEscape
    	pp$8.regexp_eatCharacterEscape = function(state) {
    	  return (
    	    this.regexp_eatControlEscape(state) ||
    	    this.regexp_eatCControlLetter(state) ||
    	    this.regexp_eatZero(state) ||
    	    this.regexp_eatHexEscapeSequence(state) ||
    	    this.regexp_eatRegExpUnicodeEscapeSequence(state) ||
    	    (!state.switchU && this.regexp_eatLegacyOctalEscapeSequence(state)) ||
    	    this.regexp_eatIdentityEscape(state)
    	  )
    	};
    	pp$8.regexp_eatCControlLetter = function(state) {
    	  var start = state.pos;
    	  if (state.eat(0x63 /* c */)) {
    	    if (this.regexp_eatControlLetter(state)) {
    	      return true
    	    }
    	    state.pos = start;
    	  }
    	  return false
    	};
    	pp$8.regexp_eatZero = function(state) {
    	  if (state.current() === 0x30 /* 0 */ && !isDecimalDigit(state.lookahead())) {
    	    state.lastIntValue = 0;
    	    state.advance();
    	    return true
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-ControlEscape
    	pp$8.regexp_eatControlEscape = function(state) {
    	  var ch = state.current();
    	  if (ch === 0x74 /* t */) {
    	    state.lastIntValue = 0x09; /* \t */
    	    state.advance();
    	    return true
    	  }
    	  if (ch === 0x6E /* n */) {
    	    state.lastIntValue = 0x0A; /* \n */
    	    state.advance();
    	    return true
    	  }
    	  if (ch === 0x76 /* v */) {
    	    state.lastIntValue = 0x0B; /* \v */
    	    state.advance();
    	    return true
    	  }
    	  if (ch === 0x66 /* f */) {
    	    state.lastIntValue = 0x0C; /* \f */
    	    state.advance();
    	    return true
    	  }
    	  if (ch === 0x72 /* r */) {
    	    state.lastIntValue = 0x0D; /* \r */
    	    state.advance();
    	    return true
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-ControlLetter
    	pp$8.regexp_eatControlLetter = function(state) {
    	  var ch = state.current();
    	  if (isControlLetter(ch)) {
    	    state.lastIntValue = ch % 0x20;
    	    state.advance();
    	    return true
    	  }
    	  return false
    	};
    	function isControlLetter(ch) {
    	  return (
    	    (ch >= 0x41 /* A */ && ch <= 0x5A /* Z */) ||
    	    (ch >= 0x61 /* a */ && ch <= 0x7A /* z */)
    	  )
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-RegExpUnicodeEscapeSequence
    	pp$8.regexp_eatRegExpUnicodeEscapeSequence = function(state) {
    	  var start = state.pos;

    	  if (state.eat(0x75 /* u */)) {
    	    if (this.regexp_eatFixedHexDigits(state, 4)) {
    	      var lead = state.lastIntValue;
    	      if (state.switchU && lead >= 0xD800 && lead <= 0xDBFF) {
    	        var leadSurrogateEnd = state.pos;
    	        if (state.eat(0x5C /* \ */) && state.eat(0x75 /* u */) && this.regexp_eatFixedHexDigits(state, 4)) {
    	          var trail = state.lastIntValue;
    	          if (trail >= 0xDC00 && trail <= 0xDFFF) {
    	            state.lastIntValue = (lead - 0xD800) * 0x400 + (trail - 0xDC00) + 0x10000;
    	            return true
    	          }
    	        }
    	        state.pos = leadSurrogateEnd;
    	        state.lastIntValue = lead;
    	      }
    	      return true
    	    }
    	    if (
    	      state.switchU &&
    	      state.eat(0x7B /* { */) &&
    	      this.regexp_eatHexDigits(state) &&
    	      state.eat(0x7D /* } */) &&
    	      isValidUnicode(state.lastIntValue)
    	    ) {
    	      return true
    	    }
    	    if (state.switchU) {
    	      state.raise("Invalid unicode escape");
    	    }
    	    state.pos = start;
    	  }

    	  return false
    	};
    	function isValidUnicode(ch) {
    	  return ch >= 0 && ch <= 0x10FFFF
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-IdentityEscape
    	pp$8.regexp_eatIdentityEscape = function(state) {
    	  if (state.switchU) {
    	    if (this.regexp_eatSyntaxCharacter(state)) {
    	      return true
    	    }
    	    if (state.eat(0x2F /* / */)) {
    	      state.lastIntValue = 0x2F; /* / */
    	      return true
    	    }
    	    return false
    	  }

    	  var ch = state.current();
    	  if (ch !== 0x63 /* c */ && (!state.switchN || ch !== 0x6B /* k */)) {
    	    state.lastIntValue = ch;
    	    state.advance();
    	    return true
    	  }

    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalEscape
    	pp$8.regexp_eatDecimalEscape = function(state) {
    	  state.lastIntValue = 0;
    	  var ch = state.current();
    	  if (ch >= 0x31 /* 1 */ && ch <= 0x39 /* 9 */) {
    	    do {
    	      state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
    	      state.advance();
    	    } while ((ch = state.current()) >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */)
    	    return true
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClassEscape
    	pp$8.regexp_eatCharacterClassEscape = function(state) {
    	  var ch = state.current();

    	  if (isCharacterClassEscape(ch)) {
    	    state.lastIntValue = -1;
    	    state.advance();
    	    return true
    	  }

    	  if (
    	    state.switchU &&
    	    this.options.ecmaVersion >= 9 &&
    	    (ch === 0x50 /* P */ || ch === 0x70 /* p */)
    	  ) {
    	    state.lastIntValue = -1;
    	    state.advance();
    	    if (
    	      state.eat(0x7B /* { */) &&
    	      this.regexp_eatUnicodePropertyValueExpression(state) &&
    	      state.eat(0x7D /* } */)
    	    ) {
    	      return true
    	    }
    	    state.raise("Invalid property name");
    	  }

    	  return false
    	};
    	function isCharacterClassEscape(ch) {
    	  return (
    	    ch === 0x64 /* d */ ||
    	    ch === 0x44 /* D */ ||
    	    ch === 0x73 /* s */ ||
    	    ch === 0x53 /* S */ ||
    	    ch === 0x77 /* w */ ||
    	    ch === 0x57 /* W */
    	  )
    	}

    	// UnicodePropertyValueExpression ::
    	//   UnicodePropertyName `=` UnicodePropertyValue
    	//   LoneUnicodePropertyNameOrValue
    	pp$8.regexp_eatUnicodePropertyValueExpression = function(state) {
    	  var start = state.pos;

    	  // UnicodePropertyName `=` UnicodePropertyValue
    	  if (this.regexp_eatUnicodePropertyName(state) && state.eat(0x3D /* = */)) {
    	    var name = state.lastStringValue;
    	    if (this.regexp_eatUnicodePropertyValue(state)) {
    	      var value = state.lastStringValue;
    	      this.regexp_validateUnicodePropertyNameAndValue(state, name, value);
    	      return true
    	    }
    	  }
    	  state.pos = start;

    	  // LoneUnicodePropertyNameOrValue
    	  if (this.regexp_eatLoneUnicodePropertyNameOrValue(state)) {
    	    var nameOrValue = state.lastStringValue;
    	    this.regexp_validateUnicodePropertyNameOrValue(state, nameOrValue);
    	    return true
    	  }
    	  return false
    	};
    	pp$8.regexp_validateUnicodePropertyNameAndValue = function(state, name, value) {
    	  if (!has(state.unicodeProperties.nonBinary, name))
    	    { state.raise("Invalid property name"); }
    	  if (!state.unicodeProperties.nonBinary[name].test(value))
    	    { state.raise("Invalid property value"); }
    	};
    	pp$8.regexp_validateUnicodePropertyNameOrValue = function(state, nameOrValue) {
    	  if (!state.unicodeProperties.binary.test(nameOrValue))
    	    { state.raise("Invalid property name"); }
    	};

    	// UnicodePropertyName ::
    	//   UnicodePropertyNameCharacters
    	pp$8.regexp_eatUnicodePropertyName = function(state) {
    	  var ch = 0;
    	  state.lastStringValue = "";
    	  while (isUnicodePropertyNameCharacter(ch = state.current())) {
    	    state.lastStringValue += codePointToString(ch);
    	    state.advance();
    	  }
    	  return state.lastStringValue !== ""
    	};
    	function isUnicodePropertyNameCharacter(ch) {
    	  return isControlLetter(ch) || ch === 0x5F /* _ */
    	}

    	// UnicodePropertyValue ::
    	//   UnicodePropertyValueCharacters
    	pp$8.regexp_eatUnicodePropertyValue = function(state) {
    	  var ch = 0;
    	  state.lastStringValue = "";
    	  while (isUnicodePropertyValueCharacter(ch = state.current())) {
    	    state.lastStringValue += codePointToString(ch);
    	    state.advance();
    	  }
    	  return state.lastStringValue !== ""
    	};
    	function isUnicodePropertyValueCharacter(ch) {
    	  return isUnicodePropertyNameCharacter(ch) || isDecimalDigit(ch)
    	}

    	// LoneUnicodePropertyNameOrValue ::
    	//   UnicodePropertyValueCharacters
    	pp$8.regexp_eatLoneUnicodePropertyNameOrValue = function(state) {
    	  return this.regexp_eatUnicodePropertyValue(state)
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-CharacterClass
    	pp$8.regexp_eatCharacterClass = function(state) {
    	  if (state.eat(0x5B /* [ */)) {
    	    state.eat(0x5E /* ^ */);
    	    this.regexp_classRanges(state);
    	    if (state.eat(0x5D /* [ */)) {
    	      return true
    	    }
    	    // Unreachable since it threw "unterminated regular expression" error before.
    	    state.raise("Unterminated character class");
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassRanges
    	// https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRanges
    	// https://www.ecma-international.org/ecma-262/8.0/#prod-NonemptyClassRangesNoDash
    	pp$8.regexp_classRanges = function(state) {
    	  while (this.regexp_eatClassAtom(state)) {
    	    var left = state.lastIntValue;
    	    if (state.eat(0x2D /* - */) && this.regexp_eatClassAtom(state)) {
    	      var right = state.lastIntValue;
    	      if (state.switchU && (left === -1 || right === -1)) {
    	        state.raise("Invalid character class");
    	      }
    	      if (left !== -1 && right !== -1 && left > right) {
    	        state.raise("Range out of order in character class");
    	      }
    	    }
    	  }
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtom
    	// https://www.ecma-international.org/ecma-262/8.0/#prod-ClassAtomNoDash
    	pp$8.regexp_eatClassAtom = function(state) {
    	  var start = state.pos;

    	  if (state.eat(0x5C /* \ */)) {
    	    if (this.regexp_eatClassEscape(state)) {
    	      return true
    	    }
    	    if (state.switchU) {
    	      // Make the same message as V8.
    	      var ch$1 = state.current();
    	      if (ch$1 === 0x63 /* c */ || isOctalDigit(ch$1)) {
    	        state.raise("Invalid class escape");
    	      }
    	      state.raise("Invalid escape");
    	    }
    	    state.pos = start;
    	  }

    	  var ch = state.current();
    	  if (ch !== 0x5D /* [ */) {
    	    state.lastIntValue = ch;
    	    state.advance();
    	    return true
    	  }

    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassEscape
    	pp$8.regexp_eatClassEscape = function(state) {
    	  var start = state.pos;

    	  if (state.eat(0x62 /* b */)) {
    	    state.lastIntValue = 0x08; /* <BS> */
    	    return true
    	  }

    	  if (state.switchU && state.eat(0x2D /* - */)) {
    	    state.lastIntValue = 0x2D; /* - */
    	    return true
    	  }

    	  if (!state.switchU && state.eat(0x63 /* c */)) {
    	    if (this.regexp_eatClassControlLetter(state)) {
    	      return true
    	    }
    	    state.pos = start;
    	  }

    	  return (
    	    this.regexp_eatCharacterClassEscape(state) ||
    	    this.regexp_eatCharacterEscape(state)
    	  )
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-ClassControlLetter
    	pp$8.regexp_eatClassControlLetter = function(state) {
    	  var ch = state.current();
    	  if (isDecimalDigit(ch) || ch === 0x5F /* _ */) {
    	    state.lastIntValue = ch % 0x20;
    	    state.advance();
    	    return true
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
    	pp$8.regexp_eatHexEscapeSequence = function(state) {
    	  var start = state.pos;
    	  if (state.eat(0x78 /* x */)) {
    	    if (this.regexp_eatFixedHexDigits(state, 2)) {
    	      return true
    	    }
    	    if (state.switchU) {
    	      state.raise("Invalid escape");
    	    }
    	    state.pos = start;
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-DecimalDigits
    	pp$8.regexp_eatDecimalDigits = function(state) {
    	  var start = state.pos;
    	  var ch = 0;
    	  state.lastIntValue = 0;
    	  while (isDecimalDigit(ch = state.current())) {
    	    state.lastIntValue = 10 * state.lastIntValue + (ch - 0x30 /* 0 */);
    	    state.advance();
    	  }
    	  return state.pos !== start
    	};
    	function isDecimalDigit(ch) {
    	  return ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigits
    	pp$8.regexp_eatHexDigits = function(state) {
    	  var start = state.pos;
    	  var ch = 0;
    	  state.lastIntValue = 0;
    	  while (isHexDigit(ch = state.current())) {
    	    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    	    state.advance();
    	  }
    	  return state.pos !== start
    	};
    	function isHexDigit(ch) {
    	  return (
    	    (ch >= 0x30 /* 0 */ && ch <= 0x39 /* 9 */) ||
    	    (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) ||
    	    (ch >= 0x61 /* a */ && ch <= 0x66 /* f */)
    	  )
    	}
    	function hexToInt(ch) {
    	  if (ch >= 0x41 /* A */ && ch <= 0x46 /* F */) {
    	    return 10 + (ch - 0x41 /* A */)
    	  }
    	  if (ch >= 0x61 /* a */ && ch <= 0x66 /* f */) {
    	    return 10 + (ch - 0x61 /* a */)
    	  }
    	  return ch - 0x30 /* 0 */
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-annexB-LegacyOctalEscapeSequence
    	// Allows only 0-377(octal) i.e. 0-255(decimal).
    	pp$8.regexp_eatLegacyOctalEscapeSequence = function(state) {
    	  if (this.regexp_eatOctalDigit(state)) {
    	    var n1 = state.lastIntValue;
    	    if (this.regexp_eatOctalDigit(state)) {
    	      var n2 = state.lastIntValue;
    	      if (n1 <= 3 && this.regexp_eatOctalDigit(state)) {
    	        state.lastIntValue = n1 * 64 + n2 * 8 + state.lastIntValue;
    	      } else {
    	        state.lastIntValue = n1 * 8 + n2;
    	      }
    	    } else {
    	      state.lastIntValue = n1;
    	    }
    	    return true
    	  }
    	  return false
    	};

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-OctalDigit
    	pp$8.regexp_eatOctalDigit = function(state) {
    	  var ch = state.current();
    	  if (isOctalDigit(ch)) {
    	    state.lastIntValue = ch - 0x30; /* 0 */
    	    state.advance();
    	    return true
    	  }
    	  state.lastIntValue = 0;
    	  return false
    	};
    	function isOctalDigit(ch) {
    	  return ch >= 0x30 /* 0 */ && ch <= 0x37 /* 7 */
    	}

    	// https://www.ecma-international.org/ecma-262/8.0/#prod-Hex4Digits
    	// https://www.ecma-international.org/ecma-262/8.0/#prod-HexDigit
    	// And HexDigit HexDigit in https://www.ecma-international.org/ecma-262/8.0/#prod-HexEscapeSequence
    	pp$8.regexp_eatFixedHexDigits = function(state, length) {
    	  var start = state.pos;
    	  state.lastIntValue = 0;
    	  for (var i = 0; i < length; ++i) {
    	    var ch = state.current();
    	    if (!isHexDigit(ch)) {
    	      state.pos = start;
    	      return false
    	    }
    	    state.lastIntValue = 16 * state.lastIntValue + hexToInt(ch);
    	    state.advance();
    	  }
    	  return true
    	};

    	// Object type used to represent tokens. Note that normally, tokens
    	// simply exist as properties on the parser object. This is only
    	// used for the onToken callback and the external tokenizer.

    	var Token = function Token(p) {
    	  this.type = p.type;
    	  this.value = p.value;
    	  this.start = p.start;
    	  this.end = p.end;
    	  if (p.options.locations)
    	    { this.loc = new SourceLocation(p, p.startLoc, p.endLoc); }
    	  if (p.options.ranges)
    	    { this.range = [p.start, p.end]; }
    	};

    	// ## Tokenizer

    	var pp$9 = Parser.prototype;

    	// Move to the next token

    	pp$9.next = function() {
    	  if (this.options.onToken)
    	    { this.options.onToken(new Token(this)); }

    	  this.lastTokEnd = this.end;
    	  this.lastTokStart = this.start;
    	  this.lastTokEndLoc = this.endLoc;
    	  this.lastTokStartLoc = this.startLoc;
    	  this.nextToken();
    	};

    	pp$9.getToken = function() {
    	  this.next();
    	  return new Token(this)
    	};

    	// If we're in an ES6 environment, make parsers iterable
    	if (typeof Symbol !== "undefined")
    	  { pp$9[Symbol.iterator] = function() {
    	    var this$1 = this;

    	    return {
    	      next: function () {
    	        var token = this$1.getToken();
    	        return {
    	          done: token.type === types.eof,
    	          value: token
    	        }
    	      }
    	    }
    	  }; }

    	// Toggle strict mode. Re-reads the next number or string to please
    	// pedantic tests (`"use strict"; 010;` should fail).

    	pp$9.curContext = function() {
    	  return this.context[this.context.length - 1]
    	};

    	// Read a single token, updating the parser object's token-related
    	// properties.

    	pp$9.nextToken = function() {
    	  var curContext = this.curContext();
    	  if (!curContext || !curContext.preserveSpace) { this.skipSpace(); }

    	  this.start = this.pos;
    	  if (this.options.locations) { this.startLoc = this.curPosition(); }
    	  if (this.pos >= this.input.length) { return this.finishToken(types.eof) }

    	  if (curContext.override) { return curContext.override(this) }
    	  else { this.readToken(this.fullCharCodeAtPos()); }
    	};

    	pp$9.readToken = function(code) {
    	  // Identifier or keyword. '\uXXXX' sequences are allowed in
    	  // identifiers, so '\' also dispatches to that.
    	  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */)
    	    { return this.readWord() }

    	  return this.getTokenFromCode(code)
    	};

    	pp$9.fullCharCodeAtPos = function() {
    	  var code = this.input.charCodeAt(this.pos);
    	  if (code <= 0xd7ff || code >= 0xe000) { return code }
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  return (code << 10) + next - 0x35fdc00
    	};

    	pp$9.skipBlockComment = function() {
    	  var startLoc = this.options.onComment && this.curPosition();
    	  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
    	  if (end === -1) { this.raise(this.pos - 2, "Unterminated comment"); }
    	  this.pos = end + 2;
    	  if (this.options.locations) {
    	    lineBreakG.lastIndex = start;
    	    var match;
    	    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
    	      ++this.curLine;
    	      this.lineStart = match.index + match[0].length;
    	    }
    	  }
    	  if (this.options.onComment)
    	    { this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,
    	                           startLoc, this.curPosition()); }
    	};

    	pp$9.skipLineComment = function(startSkip) {
    	  var start = this.pos;
    	  var startLoc = this.options.onComment && this.curPosition();
    	  var ch = this.input.charCodeAt(this.pos += startSkip);
    	  while (this.pos < this.input.length && !isNewLine(ch)) {
    	    ch = this.input.charCodeAt(++this.pos);
    	  }
    	  if (this.options.onComment)
    	    { this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,
    	                           startLoc, this.curPosition()); }
    	};

    	// Called at the start of the parse and after every token. Skips
    	// whitespace and comments, and.

    	pp$9.skipSpace = function() {
    	  loop: while (this.pos < this.input.length) {
    	    var ch = this.input.charCodeAt(this.pos);
    	    switch (ch) {
    	    case 32: case 160: // ' '
    	      ++this.pos;
    	      break
    	    case 13:
    	      if (this.input.charCodeAt(this.pos + 1) === 10) {
    	        ++this.pos;
    	      }
    	    case 10: case 8232: case 8233:
    	      ++this.pos;
    	      if (this.options.locations) {
    	        ++this.curLine;
    	        this.lineStart = this.pos;
    	      }
    	      break
    	    case 47: // '/'
    	      switch (this.input.charCodeAt(this.pos + 1)) {
    	      case 42: // '*'
    	        this.skipBlockComment();
    	        break
    	      case 47:
    	        this.skipLineComment(2);
    	        break
    	      default:
    	        break loop
    	      }
    	      break
    	    default:
    	      if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
    	        ++this.pos;
    	      } else {
    	        break loop
    	      }
    	    }
    	  }
    	};

    	// Called at the end of every token. Sets `end`, `val`, and
    	// maintains `context` and `exprAllowed`, and skips the space after
    	// the token, so that the next one's `start` will point at the
    	// right position.

    	pp$9.finishToken = function(type, val) {
    	  this.end = this.pos;
    	  if (this.options.locations) { this.endLoc = this.curPosition(); }
    	  var prevType = this.type;
    	  this.type = type;
    	  this.value = val;

    	  this.updateContext(prevType);
    	};

    	// ### Token reading

    	// This is the function that is called to fetch the next token. It
    	// is somewhat obscure, because it works in character codes rather
    	// than characters, and because operator parsing has been inlined
    	// into it.
    	//
    	// All in the name of speed.
    	//
    	pp$9.readToken_dot = function() {
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  if (next >= 48 && next <= 57) { return this.readNumber(true) }
    	  var next2 = this.input.charCodeAt(this.pos + 2);
    	  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'
    	    this.pos += 3;
    	    return this.finishToken(types.ellipsis)
    	  } else {
    	    ++this.pos;
    	    return this.finishToken(types.dot)
    	  }
    	};

    	pp$9.readToken_slash = function() { // '/'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  if (this.exprAllowed) { ++this.pos; return this.readRegexp() }
    	  if (next === 61) { return this.finishOp(types.assign, 2) }
    	  return this.finishOp(types.slash, 1)
    	};

    	pp$9.readToken_mult_modulo_exp = function(code) { // '%*'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  var size = 1;
    	  var tokentype = code === 42 ? types.star : types.modulo;

    	  // exponentiation operator ** and **=
    	  if (this.options.ecmaVersion >= 7 && code === 42 && next === 42) {
    	    ++size;
    	    tokentype = types.starstar;
    	    next = this.input.charCodeAt(this.pos + 2);
    	  }

    	  if (next === 61) { return this.finishOp(types.assign, size + 1) }
    	  return this.finishOp(tokentype, size)
    	};

    	pp$9.readToken_pipe_amp = function(code) { // '|&'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  if (next === code) { return this.finishOp(code === 124 ? types.logicalOR : types.logicalAND, 2) }
    	  if (next === 61) { return this.finishOp(types.assign, 2) }
    	  return this.finishOp(code === 124 ? types.bitwiseOR : types.bitwiseAND, 1)
    	};

    	pp$9.readToken_caret = function() { // '^'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  if (next === 61) { return this.finishOp(types.assign, 2) }
    	  return this.finishOp(types.bitwiseXOR, 1)
    	};

    	pp$9.readToken_plus_min = function(code) { // '+-'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  if (next === code) {
    	    if (next === 45 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 62 &&
    	        (this.lastTokEnd === 0 || lineBreak.test(this.input.slice(this.lastTokEnd, this.pos)))) {
    	      // A `-->` line comment
    	      this.skipLineComment(3);
    	      this.skipSpace();
    	      return this.nextToken()
    	    }
    	    return this.finishOp(types.incDec, 2)
    	  }
    	  if (next === 61) { return this.finishOp(types.assign, 2) }
    	  return this.finishOp(types.plusMin, 1)
    	};

    	pp$9.readToken_lt_gt = function(code) { // '<>'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  var size = 1;
    	  if (next === code) {
    	    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    	    if (this.input.charCodeAt(this.pos + size) === 61) { return this.finishOp(types.assign, size + 1) }
    	    return this.finishOp(types.bitShift, size)
    	  }
    	  if (next === 33 && code === 60 && !this.inModule && this.input.charCodeAt(this.pos + 2) === 45 &&
    	      this.input.charCodeAt(this.pos + 3) === 45) {
    	    // `<!--`, an XML-style comment that should be interpreted as a line comment
    	    this.skipLineComment(4);
    	    this.skipSpace();
    	    return this.nextToken()
    	  }
    	  if (next === 61) { size = 2; }
    	  return this.finishOp(types.relational, size)
    	};

    	pp$9.readToken_eq_excl = function(code) { // '=!'
    	  var next = this.input.charCodeAt(this.pos + 1);
    	  if (next === 61) { return this.finishOp(types.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2) }
    	  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) { // '=>'
    	    this.pos += 2;
    	    return this.finishToken(types.arrow)
    	  }
    	  return this.finishOp(code === 61 ? types.eq : types.prefix, 1)
    	};

    	pp$9.getTokenFromCode = function(code) {
    	  switch (code) {
    	  // The interpretation of a dot depends on whether it is followed
    	  // by a digit or another two dots.
    	  case 46: // '.'
    	    return this.readToken_dot()

    	  // Punctuation tokens.
    	  case 40: ++this.pos; return this.finishToken(types.parenL)
    	  case 41: ++this.pos; return this.finishToken(types.parenR)
    	  case 59: ++this.pos; return this.finishToken(types.semi)
    	  case 44: ++this.pos; return this.finishToken(types.comma)
    	  case 91: ++this.pos; return this.finishToken(types.bracketL)
    	  case 93: ++this.pos; return this.finishToken(types.bracketR)
    	  case 123: ++this.pos; return this.finishToken(types.braceL)
    	  case 125: ++this.pos; return this.finishToken(types.braceR)
    	  case 58: ++this.pos; return this.finishToken(types.colon)
    	  case 63: ++this.pos; return this.finishToken(types.question)

    	  case 96: // '`'
    	    if (this.options.ecmaVersion < 6) { break }
    	    ++this.pos;
    	    return this.finishToken(types.backQuote)

    	  case 48: // '0'
    	    var next = this.input.charCodeAt(this.pos + 1);
    	    if (next === 120 || next === 88) { return this.readRadixNumber(16) } // '0x', '0X' - hex number
    	    if (this.options.ecmaVersion >= 6) {
    	      if (next === 111 || next === 79) { return this.readRadixNumber(8) } // '0o', '0O' - octal number
    	      if (next === 98 || next === 66) { return this.readRadixNumber(2) } // '0b', '0B' - binary number
    	    }

    	  // Anything else beginning with a digit is an integer, octal
    	  // number, or float.
    	  case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
    	    return this.readNumber(false)

    	  // Quotes produce strings.
    	  case 34: case 39: // '"', "'"
    	    return this.readString(code)

    	  // Operators are parsed inline in tiny state machines. '=' (61) is
    	  // often referred to. `finishOp` simply skips the amount of
    	  // characters it is given as second argument, and returns a token
    	  // of the type given by its first argument.

    	  case 47: // '/'
    	    return this.readToken_slash()

    	  case 37: case 42: // '%*'
    	    return this.readToken_mult_modulo_exp(code)

    	  case 124: case 38: // '|&'
    	    return this.readToken_pipe_amp(code)

    	  case 94: // '^'
    	    return this.readToken_caret()

    	  case 43: case 45: // '+-'
    	    return this.readToken_plus_min(code)

    	  case 60: case 62: // '<>'
    	    return this.readToken_lt_gt(code)

    	  case 61: case 33: // '=!'
    	    return this.readToken_eq_excl(code)

    	  case 126: // '~'
    	    return this.finishOp(types.prefix, 1)
    	  }

    	  this.raise(this.pos, "Unexpected character '" + codePointToString$1(code) + "'");
    	};

    	pp$9.finishOp = function(type, size) {
    	  var str = this.input.slice(this.pos, this.pos + size);
    	  this.pos += size;
    	  return this.finishToken(type, str)
    	};

    	pp$9.readRegexp = function() {
    	  var escaped, inClass, start = this.pos;
    	  for (;;) {
    	    if (this.pos >= this.input.length) { this.raise(start, "Unterminated regular expression"); }
    	    var ch = this.input.charAt(this.pos);
    	    if (lineBreak.test(ch)) { this.raise(start, "Unterminated regular expression"); }
    	    if (!escaped) {
    	      if (ch === "[") { inClass = true; }
    	      else if (ch === "]" && inClass) { inClass = false; }
    	      else if (ch === "/" && !inClass) { break }
    	      escaped = ch === "\\";
    	    } else { escaped = false; }
    	    ++this.pos;
    	  }
    	  var pattern = this.input.slice(start, this.pos);
    	  ++this.pos;
    	  var flagsStart = this.pos;
    	  var flags = this.readWord1();
    	  if (this.containsEsc) { this.unexpected(flagsStart); }

    	  // Validate pattern
    	  var state = this.regexpState || (this.regexpState = new RegExpValidationState(this));
    	  state.reset(start, pattern, flags);
    	  this.validateRegExpFlags(state);
    	  this.validateRegExpPattern(state);

    	  // Create Literal#value property value.
    	  var value = null;
    	  try {
    	    value = new RegExp(pattern, flags);
    	  } catch (e) {
    	    // ESTree requires null if it failed to instantiate RegExp object.
    	    // https://github.com/estree/estree/blob/a27003adf4fd7bfad44de9cef372a2eacd527b1c/es5.md#regexpliteral
    	  }

    	  return this.finishToken(types.regexp, {pattern: pattern, flags: flags, value: value})
    	};

    	// Read an integer in the given radix. Return null if zero digits
    	// were read, the integer value otherwise. When `len` is given, this
    	// will return `null` unless the integer has exactly `len` digits.

    	pp$9.readInt = function(radix, len) {
    	  var start = this.pos, total = 0;
    	  for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
    	    var code = this.input.charCodeAt(this.pos), val = (void 0);
    	    if (code >= 97) { val = code - 97 + 10; } // a
    	    else if (code >= 65) { val = code - 65 + 10; } // A
    	    else if (code >= 48 && code <= 57) { val = code - 48; } // 0-9
    	    else { val = Infinity; }
    	    if (val >= radix) { break }
    	    ++this.pos;
    	    total = total * radix + val;
    	  }
    	  if (this.pos === start || len != null && this.pos - start !== len) { return null }

    	  return total
    	};

    	pp$9.readRadixNumber = function(radix) {
    	  var start = this.pos;
    	  this.pos += 2; // 0x
    	  var val = this.readInt(radix);
    	  if (val == null) { this.raise(this.start + 2, "Expected number in radix " + radix); }
    	  if (this.options.ecmaVersion >= 11 && this.input.charCodeAt(this.pos) === 110) {
    	    val = typeof BigInt !== "undefined" ? BigInt(this.input.slice(start, this.pos)) : null;
    	    ++this.pos;
    	  } else if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
    	  return this.finishToken(types.num, val)
    	};

    	// Read an integer, octal integer, or floating-point number.

    	pp$9.readNumber = function(startsWithDot) {
    	  var start = this.pos;
    	  if (!startsWithDot && this.readInt(10) === null) { this.raise(start, "Invalid number"); }
    	  var octal = this.pos - start >= 2 && this.input.charCodeAt(start) === 48;
    	  if (octal && this.strict) { this.raise(start, "Invalid number"); }
    	  if (octal && /[89]/.test(this.input.slice(start, this.pos))) { octal = false; }
    	  var next = this.input.charCodeAt(this.pos);
    	  if (!octal && !startsWithDot && this.options.ecmaVersion >= 11 && next === 110) {
    	    var str$1 = this.input.slice(start, this.pos);
    	    var val$1 = typeof BigInt !== "undefined" ? BigInt(str$1) : null;
    	    ++this.pos;
    	    if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }
    	    return this.finishToken(types.num, val$1)
    	  }
    	  if (next === 46 && !octal) { // '.'
    	    ++this.pos;
    	    this.readInt(10);
    	    next = this.input.charCodeAt(this.pos);
    	  }
    	  if ((next === 69 || next === 101) && !octal) { // 'eE'
    	    next = this.input.charCodeAt(++this.pos);
    	    if (next === 43 || next === 45) { ++this.pos; } // '+-'
    	    if (this.readInt(10) === null) { this.raise(start, "Invalid number"); }
    	  }
    	  if (isIdentifierStart(this.fullCharCodeAtPos())) { this.raise(this.pos, "Identifier directly after number"); }

    	  var str = this.input.slice(start, this.pos);
    	  var val = octal ? parseInt(str, 8) : parseFloat(str);
    	  return this.finishToken(types.num, val)
    	};

    	// Read a string value, interpreting backslash-escapes.

    	pp$9.readCodePoint = function() {
    	  var ch = this.input.charCodeAt(this.pos), code;

    	  if (ch === 123) { // '{'
    	    if (this.options.ecmaVersion < 6) { this.unexpected(); }
    	    var codePos = ++this.pos;
    	    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    	    ++this.pos;
    	    if (code > 0x10FFFF) { this.invalidStringToken(codePos, "Code point out of bounds"); }
    	  } else {
    	    code = this.readHexChar(4);
    	  }
    	  return code
    	};

    	function codePointToString$1(code) {
    	  // UTF-16 Decoding
    	  if (code <= 0xFFFF) { return String.fromCharCode(code) }
    	  code -= 0x10000;
    	  return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00)
    	}

    	pp$9.readString = function(quote) {
    	  var out = "", chunkStart = ++this.pos;
    	  for (;;) {
    	    if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated string constant"); }
    	    var ch = this.input.charCodeAt(this.pos);
    	    if (ch === quote) { break }
    	    if (ch === 92) { // '\'
    	      out += this.input.slice(chunkStart, this.pos);
    	      out += this.readEscapedChar(false);
    	      chunkStart = this.pos;
    	    } else {
    	      if (isNewLine(ch, this.options.ecmaVersion >= 10)) { this.raise(this.start, "Unterminated string constant"); }
    	      ++this.pos;
    	    }
    	  }
    	  out += this.input.slice(chunkStart, this.pos++);
    	  return this.finishToken(types.string, out)
    	};

    	// Reads template string tokens.

    	var INVALID_TEMPLATE_ESCAPE_ERROR = {};

    	pp$9.tryReadTemplateToken = function() {
    	  this.inTemplateElement = true;
    	  try {
    	    this.readTmplToken();
    	  } catch (err) {
    	    if (err === INVALID_TEMPLATE_ESCAPE_ERROR) {
    	      this.readInvalidTemplateToken();
    	    } else {
    	      throw err
    	    }
    	  }

    	  this.inTemplateElement = false;
    	};

    	pp$9.invalidStringToken = function(position, message) {
    	  if (this.inTemplateElement && this.options.ecmaVersion >= 9) {
    	    throw INVALID_TEMPLATE_ESCAPE_ERROR
    	  } else {
    	    this.raise(position, message);
    	  }
    	};

    	pp$9.readTmplToken = function() {
    	  var out = "", chunkStart = this.pos;
    	  for (;;) {
    	    if (this.pos >= this.input.length) { this.raise(this.start, "Unterminated template"); }
    	    var ch = this.input.charCodeAt(this.pos);
    	    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) { // '`', '${'
    	      if (this.pos === this.start && (this.type === types.template || this.type === types.invalidTemplate)) {
    	        if (ch === 36) {
    	          this.pos += 2;
    	          return this.finishToken(types.dollarBraceL)
    	        } else {
    	          ++this.pos;
    	          return this.finishToken(types.backQuote)
    	        }
    	      }
    	      out += this.input.slice(chunkStart, this.pos);
    	      return this.finishToken(types.template, out)
    	    }
    	    if (ch === 92) { // '\'
    	      out += this.input.slice(chunkStart, this.pos);
    	      out += this.readEscapedChar(true);
    	      chunkStart = this.pos;
    	    } else if (isNewLine(ch)) {
    	      out += this.input.slice(chunkStart, this.pos);
    	      ++this.pos;
    	      switch (ch) {
    	      case 13:
    	        if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; }
    	      case 10:
    	        out += "\n";
    	        break
    	      default:
    	        out += String.fromCharCode(ch);
    	        break
    	      }
    	      if (this.options.locations) {
    	        ++this.curLine;
    	        this.lineStart = this.pos;
    	      }
    	      chunkStart = this.pos;
    	    } else {
    	      ++this.pos;
    	    }
    	  }
    	};

    	// Reads a template token to search for the end, without validating any escape sequences
    	pp$9.readInvalidTemplateToken = function() {
    	  for (; this.pos < this.input.length; this.pos++) {
    	    switch (this.input[this.pos]) {
    	    case "\\":
    	      ++this.pos;
    	      break

    	    case "$":
    	      if (this.input[this.pos + 1] !== "{") {
    	        break
    	      }
    	    // falls through

    	    case "`":
    	      return this.finishToken(types.invalidTemplate, this.input.slice(this.start, this.pos))

    	    // no default
    	    }
    	  }
    	  this.raise(this.start, "Unterminated template");
    	};

    	// Used to read escaped characters

    	pp$9.readEscapedChar = function(inTemplate) {
    	  var ch = this.input.charCodeAt(++this.pos);
    	  ++this.pos;
    	  switch (ch) {
    	  case 110: return "\n" // 'n' -> '\n'
    	  case 114: return "\r" // 'r' -> '\r'
    	  case 120: return String.fromCharCode(this.readHexChar(2)) // 'x'
    	  case 117: return codePointToString$1(this.readCodePoint()) // 'u'
    	  case 116: return "\t" // 't' -> '\t'
    	  case 98: return "\b" // 'b' -> '\b'
    	  case 118: return "\u000b" // 'v' -> '\u000b'
    	  case 102: return "\f" // 'f' -> '\f'
    	  case 13: if (this.input.charCodeAt(this.pos) === 10) { ++this.pos; } // '\r\n'
    	  case 10: // ' \n'
    	    if (this.options.locations) { this.lineStart = this.pos; ++this.curLine; }
    	    return ""
    	  default:
    	    if (ch >= 48 && ch <= 55) {
    	      var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
    	      var octal = parseInt(octalStr, 8);
    	      if (octal > 255) {
    	        octalStr = octalStr.slice(0, -1);
    	        octal = parseInt(octalStr, 8);
    	      }
    	      this.pos += octalStr.length - 1;
    	      ch = this.input.charCodeAt(this.pos);
    	      if ((octalStr !== "0" || ch === 56 || ch === 57) && (this.strict || inTemplate)) {
    	        this.invalidStringToken(
    	          this.pos - 1 - octalStr.length,
    	          inTemplate
    	            ? "Octal literal in template string"
    	            : "Octal literal in strict mode"
    	        );
    	      }
    	      return String.fromCharCode(octal)
    	    }
    	    if (isNewLine(ch)) {
    	      // Unicode new line characters after \ get removed from output in both
    	      // template literals and strings
    	      return ""
    	    }
    	    return String.fromCharCode(ch)
    	  }
    	};

    	// Used to read character escape sequences ('\x', '\u', '\U').

    	pp$9.readHexChar = function(len) {
    	  var codePos = this.pos;
    	  var n = this.readInt(16, len);
    	  if (n === null) { this.invalidStringToken(codePos, "Bad character escape sequence"); }
    	  return n
    	};

    	// Read an identifier, and return it as a string. Sets `this.containsEsc`
    	// to whether the word contained a '\u' escape.
    	//
    	// Incrementally adds only escaped chars, adding other chunks as-is
    	// as a micro-optimization.

    	pp$9.readWord1 = function() {
    	  this.containsEsc = false;
    	  var word = "", first = true, chunkStart = this.pos;
    	  var astral = this.options.ecmaVersion >= 6;
    	  while (this.pos < this.input.length) {
    	    var ch = this.fullCharCodeAtPos();
    	    if (isIdentifierChar(ch, astral)) {
    	      this.pos += ch <= 0xffff ? 1 : 2;
    	    } else if (ch === 92) { // "\"
    	      this.containsEsc = true;
    	      word += this.input.slice(chunkStart, this.pos);
    	      var escStart = this.pos;
    	      if (this.input.charCodeAt(++this.pos) !== 117) // "u"
    	        { this.invalidStringToken(this.pos, "Expecting Unicode escape sequence \\uXXXX"); }
    	      ++this.pos;
    	      var esc = this.readCodePoint();
    	      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
    	        { this.invalidStringToken(escStart, "Invalid Unicode escape"); }
    	      word += codePointToString$1(esc);
    	      chunkStart = this.pos;
    	    } else {
    	      break
    	    }
    	    first = false;
    	  }
    	  return word + this.input.slice(chunkStart, this.pos)
    	};

    	// Read an identifier or keyword token. Will check for reserved
    	// words when necessary.

    	pp$9.readWord = function() {
    	  var word = this.readWord1();
    	  var type = types.name;
    	  if (this.keywords.test(word)) {
    	    if (this.containsEsc) { this.raiseRecoverable(this.start, "Escape sequence in keyword " + word); }
    	    type = keywords$1[word];
    	  }
    	  return this.finishToken(type, word)
    	};

    	// Acorn is a tiny, fast JavaScript parser written in JavaScript.

    	var version = "7.1.0";

    	Parser.acorn = {
    	  Parser: Parser,
    	  version: version,
    	  defaultOptions: defaultOptions,
    	  Position: Position,
    	  SourceLocation: SourceLocation,
    	  getLineInfo: getLineInfo,
    	  Node: Node,
    	  TokenType: TokenType,
    	  tokTypes: types,
    	  keywordTypes: keywords$1,
    	  TokContext: TokContext,
    	  tokContexts: types$1,
    	  isIdentifierChar: isIdentifierChar,
    	  isIdentifierStart: isIdentifierStart,
    	  Token: Token,
    	  isNewLine: isNewLine,
    	  lineBreak: lineBreak,
    	  lineBreakG: lineBreakG,
    	  nonASCIIwhitespace: nonASCIIwhitespace
    	};

    	// The main exported interface (under `self.acorn` when in the
    	// browser) is a `parse` function that takes a code string and
    	// returns an abstract syntax tree as specified by [Mozilla parser
    	// API][api].
    	//
    	// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

    	function parse(input, options) {
    	  return Parser.parse(input, options)
    	}

    	// This function tries to parse a single expression at a given
    	// offset in a string. Useful for parsing mixed-language formats
    	// that embed JavaScript expressions.

    	function parseExpressionAt(input, pos, options) {
    	  return Parser.parseExpressionAt(input, pos, options)
    	}

    	const Parser$1 = Parser;
    	const parse$1 = (source) => Parser$1.parse(source, {
    	    sourceType: 'module',
    	    ecmaVersion: 11,
    	    locations: true
    	});
    	const parse_expression_at = (source, index) => Parser$1.parseExpressionAt(source, index, {
    	    ecmaVersion: 11,
    	    locations: true
    	});

    	const whitespace = /[ \t\r\n]/;
    	const dimensions = /^(?:offset|client)(?:Width|Height)$/;

    	const literals = new Map([['true', true], ['false', false], ['null', null]]);
    	function read_expression(parser) {
    	    const start = parser.index;
    	    const name = parser.read_until(/\s*}/);
    	    if (name && /^[a-z]+$/.test(name)) {
    	        const end = start + name.length;
    	        if (literals.has(name)) {
    	            return {
    	                type: 'Literal',
    	                start,
    	                end,
    	                value: literals.get(name),
    	                raw: name,
    	            };
    	        }
    	        return {
    	            type: 'Identifier',
    	            start,
    	            end: start + name.length,
    	            name,
    	        };
    	    }
    	    parser.index = start;
    	    try {
    	        const node = parse_expression_at(parser.template, parser.index);
    	        let num_parens = 0;
    	        for (let i = parser.index; i < node.start; i += 1) {
    	            if (parser.template[i] === '(')
    	                num_parens += 1;
    	        }
    	        let index = node.end;
    	        while (num_parens > 0) {
    	            const char = parser.template[index];
    	            if (char === ')') {
    	                num_parens -= 1;
    	            }
    	            else if (!whitespace.test(char)) {
    	                parser.error({
    	                    code: 'unexpected-token',
    	                    message: 'Expected )'
    	                }, index);
    	            }
    	            index += 1;
    	        }
    	        parser.index = index;
    	        return node;
    	    }
    	    catch (err) {
    	        parser.acorn_error(err);
    	    }
    	}

    	const script_closing_tag = '</script>';
    	function get_context(parser, attributes, start) {
    	    const context = attributes.find(attribute => attribute.name === 'context');
    	    if (!context)
    	        return 'default';
    	    if (context.value.length !== 1 || context.value[0].type !== 'Text') {
    	        parser.error({
    	            code: 'invalid-script',
    	            message: `context attribute must be static`
    	        }, start);
    	    }
    	    const value = context.value[0].data;
    	    if (value !== 'module') {
    	        parser.error({
    	            code: `invalid-script`,
    	            message: `If the context attribute is supplied, its value must be "module"`
    	        }, context.start);
    	    }
    	    return value;
    	}
    	function read_script(parser, start, attributes) {
    	    const script_start = parser.index;
    	    const script_end = parser.template.indexOf(script_closing_tag, script_start);
    	    if (script_end === -1)
    	        parser.error({
    	            code: `unclosed-script`,
    	            message: `<script> must have a closing tag`
    	        });
    	    const source = ' '.repeat(script_start) + parser.template.slice(script_start, script_end);
    	    parser.index = script_end + script_closing_tag.length;
    	    let ast;
    	    try {
    	        ast = parse$1(source);
    	    }
    	    catch (err) {
    	        parser.acorn_error(err);
    	    }
    	    // TODO is this necessary?
    	    ast.start = script_start;
    	    return {
    	        type: 'Script',
    	        start,
    	        end: parser.index,
    	        context: get_context(parser, attributes, start),
    	        content: ast,
    	    };
    	}

    	var MAX_LINE_LENGTH = 100;
    	var OFFSET_CORRECTION = 60;
    	var TAB_REPLACEMENT = '    ';

    	function sourceFragment(error, extraLines) {
    	    function processLines(start, end) {
    	        return lines.slice(start, end).map(function(line, idx) {
    	            var num = String(start + idx + 1);

    	            while (num.length < maxNumLength) {
    	                num = ' ' + num;
    	            }

    	            return num + ' |' + line;
    	        }).join('\n');
    	    }

    	    var lines = error.source.split(/\n|\r\n?|\f/);
    	    var line = error.line;
    	    var column = error.column;
    	    var startLine = Math.max(1, line - extraLines) - 1;
    	    var endLine = Math.min(line + extraLines, lines.length + 1);
    	    var maxNumLength = Math.max(4, String(endLine).length) + 1;
    	    var cutLeft = 0;

    	    // correct column according to replaced tab before column
    	    column += (TAB_REPLACEMENT.length - 1) * (lines[line - 1].substr(0, column - 1).match(/\t/g) || []).length;

    	    if (column > MAX_LINE_LENGTH) {
    	        cutLeft = column - OFFSET_CORRECTION + 3;
    	        column = OFFSET_CORRECTION - 2;
    	    }

    	    for (var i = startLine; i <= endLine; i++) {
    	        if (i >= 0 && i < lines.length) {
    	            lines[i] = lines[i].replace(/\t/g, TAB_REPLACEMENT);
    	            lines[i] =
    	                (cutLeft > 0 && lines[i].length > cutLeft ? '\u2026' : '') +
    	                lines[i].substr(cutLeft, MAX_LINE_LENGTH - 2) +
    	                (lines[i].length > cutLeft + MAX_LINE_LENGTH - 1 ? '\u2026' : '');
    	        }
    	    }

    	    return [
    	        processLines(startLine, line),
    	        new Array(column + maxNumLength + 2).join('-') + '^',
    	        processLines(line, endLine)
    	    ].join('\n');
    	}

    	var CssSyntaxError = function(message, source, offset, line, column) {
    	    // some VMs prevent setting line/column otherwise (iOS Safari 10 even throw an exception)
    	    var error = Object.create(SyntaxError.prototype);

    	    error.name = 'CssSyntaxError';
    	    error.message = message;
    	    error.stack = (new Error().stack || '').replace(/^.+\n/, error.name + ': ' + error.message + '\n');
    	    error.source = source;
    	    error.offset = offset;
    	    error.line = line;
    	    error.column = column;

    	    error.sourceFragment = function(extraLines) {
    	        return sourceFragment(error, isNaN(extraLines) ? 0 : extraLines);
    	    };
    	    Object.defineProperty(error, 'formattedMessage', {
    	        get: function() {
    	            return (
    	                'Parse error: ' + error.message + '\n' +
    	                sourceFragment(error, 2)
    	            );
    	        }
    	    });

    	    // for backward capability
    	    error.parseError = {
    	        offset: offset,
    	        line: line,
    	        column: column
    	    };

    	    return error;
    	};

    	var error = CssSyntaxError;

    	// token types (note: value shouldn't intersect with used char codes)
    	var WHITESPACE = 1;
    	var IDENTIFIER = 2;
    	var NUMBER = 3;
    	var STRING = 4;
    	var COMMENT = 5;
    	var PUNCTUATOR = 6;
    	var CDO = 7;
    	var CDC = 8;
    	var ATRULE = 14;
    	var FUNCTION = 15;
    	var URL = 16;
    	var RAW = 17;

    	var TAB = 9;
    	var N = 10;
    	var F = 12;
    	var R = 13;
    	var SPACE = 32;

    	var TYPE = {
    	    WhiteSpace:   WHITESPACE,
    	    Identifier:   IDENTIFIER,
    	    Number:           NUMBER,
    	    String:           STRING,
    	    Comment:         COMMENT,
    	    Punctuator:   PUNCTUATOR,
    	    CDO:                 CDO,
    	    CDC:                 CDC,
    	    Atrule:           ATRULE,
    	    Function:       FUNCTION,
    	    Url:                 URL,
    	    Raw:                 RAW,

    	    ExclamationMark:      33,  // !
    	    QuotationMark:        34,  // "
    	    NumberSign:           35,  // #
    	    DollarSign:           36,  // $
    	    PercentSign:          37,  // %
    	    Ampersand:            38,  // &
    	    Apostrophe:           39,  // '
    	    LeftParenthesis:      40,  // (
    	    RightParenthesis:     41,  // )
    	    Asterisk:             42,  // *
    	    PlusSign:             43,  // +
    	    Comma:                44,  // ,
    	    HyphenMinus:          45,  // -
    	    FullStop:             46,  // .
    	    Solidus:              47,  // /
    	    Colon:                58,  // :
    	    Semicolon:            59,  // ;
    	    LessThanSign:         60,  // <
    	    EqualsSign:           61,  // =
    	    GreaterThanSign:      62,  // >
    	    QuestionMark:         63,  // ?
    	    CommercialAt:         64,  // @
    	    LeftSquareBracket:    91,  // [
    	    Backslash:            92,  // \
    	    RightSquareBracket:   93,  // ]
    	    CircumflexAccent:     94,  // ^
    	    LowLine:              95,  // _
    	    GraveAccent:          96,  // `
    	    LeftCurlyBracket:    123,  // {
    	    VerticalLine:        124,  // |
    	    RightCurlyBracket:   125,  // }
    	    Tilde:               126   // ~
    	};

    	var NAME = Object.keys(TYPE).reduce(function(result, key) {
    	    result[TYPE[key]] = key;
    	    return result;
    	}, {});

    	// https://drafts.csswg.org/css-syntax/#tokenizer-definitions
    	// > non-ASCII code point
    	// >   A code point with a value equal to or greater than U+0080 <control>
    	// > name-start code point
    	// >   A letter, a non-ASCII code point, or U+005F LOW LINE (_).
    	// > name code point
    	// >   A name-start code point, a digit, or U+002D HYPHEN-MINUS (-)
    	// That means only ASCII code points has a special meaning and we a maps for 0..127 codes only
    	var SafeUint32Array = typeof Uint32Array !== 'undefined' ? Uint32Array : Array; // fallback on Array when TypedArray is not supported
    	var SYMBOL_TYPE = new SafeUint32Array(0x80);
    	var PUNCTUATION = new SafeUint32Array(0x80);
    	var STOP_URL_RAW = new SafeUint32Array(0x80);

    	for (var i = 0; i < SYMBOL_TYPE.length; i++) {
    	    SYMBOL_TYPE[i] = IDENTIFIER;
    	}

    	// fill categories
    	[
    	    TYPE.ExclamationMark,    // !
    	    TYPE.QuotationMark,      // "
    	    TYPE.NumberSign,         // #
    	    TYPE.DollarSign,         // $
    	    TYPE.PercentSign,        // %
    	    TYPE.Ampersand,          // &
    	    TYPE.Apostrophe,         // '
    	    TYPE.LeftParenthesis,    // (
    	    TYPE.RightParenthesis,   // )
    	    TYPE.Asterisk,           // *
    	    TYPE.PlusSign,           // +
    	    TYPE.Comma,              // ,
    	    TYPE.HyphenMinus,        // -
    	    TYPE.FullStop,           // .
    	    TYPE.Solidus,            // /
    	    TYPE.Colon,              // :
    	    TYPE.Semicolon,          // ;
    	    TYPE.LessThanSign,       // <
    	    TYPE.EqualsSign,         // =
    	    TYPE.GreaterThanSign,    // >
    	    TYPE.QuestionMark,       // ?
    	    TYPE.CommercialAt,       // @
    	    TYPE.LeftSquareBracket,  // [
    	    // TYPE.Backslash,          // \
    	    TYPE.RightSquareBracket, // ]
    	    TYPE.CircumflexAccent,   // ^
    	    // TYPE.LowLine,            // _
    	    TYPE.GraveAccent,        // `
    	    TYPE.LeftCurlyBracket,   // {
    	    TYPE.VerticalLine,       // |
    	    TYPE.RightCurlyBracket,  // }
    	    TYPE.Tilde               // ~
    	].forEach(function(key) {
    	    SYMBOL_TYPE[Number(key)] = PUNCTUATOR;
    	    PUNCTUATION[Number(key)] = PUNCTUATOR;
    	});

    	for (var i = 48; i <= 57; i++) {
    	    SYMBOL_TYPE[i] = NUMBER;
    	}

    	SYMBOL_TYPE[SPACE] = WHITESPACE;
    	SYMBOL_TYPE[TAB] = WHITESPACE;
    	SYMBOL_TYPE[N] = WHITESPACE;
    	SYMBOL_TYPE[R] = WHITESPACE;
    	SYMBOL_TYPE[F] = WHITESPACE;

    	SYMBOL_TYPE[TYPE.Apostrophe] = STRING;
    	SYMBOL_TYPE[TYPE.QuotationMark] = STRING;

    	STOP_URL_RAW[SPACE] = 1;
    	STOP_URL_RAW[TAB] = 1;
    	STOP_URL_RAW[N] = 1;
    	STOP_URL_RAW[R] = 1;
    	STOP_URL_RAW[F] = 1;
    	STOP_URL_RAW[TYPE.Apostrophe] = 1;
    	STOP_URL_RAW[TYPE.QuotationMark] = 1;
    	STOP_URL_RAW[TYPE.LeftParenthesis] = 1;
    	STOP_URL_RAW[TYPE.RightParenthesis] = 1;

    	// whitespace is punctuation ...
    	PUNCTUATION[SPACE] = PUNCTUATOR;
    	PUNCTUATION[TAB] = PUNCTUATOR;
    	PUNCTUATION[N] = PUNCTUATOR;
    	PUNCTUATION[R] = PUNCTUATOR;
    	PUNCTUATION[F] = PUNCTUATOR;
    	// ... hyper minus is not
    	PUNCTUATION[TYPE.HyphenMinus] = 0;

    	var _const = {
    	    TYPE: TYPE,
    	    NAME: NAME,

    	    SYMBOL_TYPE: SYMBOL_TYPE,
    	    PUNCTUATION: PUNCTUATION,
    	    STOP_URL_RAW: STOP_URL_RAW
    	};

    	var PUNCTUATION$1 = _const.PUNCTUATION;
    	var STOP_URL_RAW$1 = _const.STOP_URL_RAW;
    	var TYPE$1 = _const.TYPE;
    	var FULLSTOP = TYPE$1.FullStop;
    	var PLUSSIGN = TYPE$1.PlusSign;
    	var HYPHENMINUS = TYPE$1.HyphenMinus;
    	var PUNCTUATOR$1 = TYPE$1.Punctuator;
    	var TAB$1 = 9;
    	var N$1 = 10;
    	var F$1 = 12;
    	var R$1 = 13;
    	var SPACE$1 = 32;
    	var BACK_SLASH = 92;
    	var E = 101; // 'e'.charCodeAt(0)

    	function firstCharOffset(source) {
    	    // detect BOM (https://en.wikipedia.org/wiki/Byte_order_mark)
    	    if (source.charCodeAt(0) === 0xFEFF ||  // UTF-16BE
    	        source.charCodeAt(0) === 0xFFFE) {  // UTF-16LE
    	        return 1;
    	    }

    	    return 0;
    	}

    	function isHex(code) {
    	    return (code >= 48 && code <= 57) || // 0 .. 9
    	           (code >= 65 && code <= 70) || // A .. F
    	           (code >= 97 && code <= 102);  // a .. f
    	}

    	function isNumber(code) {
    	    return code >= 48 && code <= 57;
    	}

    	function isNewline(source, offset, code) {
    	    if (code === N$1 || code === F$1 || code === R$1) {
    	        if (code === R$1 && offset + 1 < source.length && source.charCodeAt(offset + 1) === N$1) {
    	            return 2;
    	        }

    	        return 1;
    	    }

    	    return 0;
    	}

    	function cmpChar(testStr, offset, referenceCode) {
    	    var code = testStr.charCodeAt(offset);

    	    // code.toLowerCase()
    	    if (code >= 65 && code <= 90) {
    	        code = code | 32;
    	    }

    	    return code === referenceCode;
    	}

    	function cmpStr(testStr, start, end, referenceStr) {
    	    if (end - start !== referenceStr.length) {
    	        return false;
    	    }

    	    if (start < 0 || end > testStr.length) {
    	        return false;
    	    }

    	    for (var i = start; i < end; i++) {
    	        var testCode = testStr.charCodeAt(i);
    	        var refCode = referenceStr.charCodeAt(i - start);

    	        // testStr[i].toLowerCase()
    	        if (testCode >= 65 && testCode <= 90) {
    	            testCode = testCode | 32;
    	        }

    	        if (testCode !== refCode) {
    	            return false;
    	        }
    	    }

    	    return true;
    	}

    	function endsWith(testStr, referenceStr) {
    	    return cmpStr(testStr, testStr.length - referenceStr.length, testStr.length, referenceStr);
    	}

    	function findLastNonSpaceLocation(scanner) {
    	    for (var i = scanner.source.length - 1; i >= 0; i--) {
    	        var code = scanner.source.charCodeAt(i);

    	        if (code !== SPACE$1 && code !== TAB$1 && code !== R$1 && code !== N$1 && code !== F$1) {
    	            break;
    	        }
    	    }

    	    return scanner.getLocation(i + 1);
    	}

    	function findWhiteSpaceEnd(source, offset) {
    	    for (; offset < source.length; offset++) {
    	        var code = source.charCodeAt(offset);

    	        if (code !== SPACE$1 && code !== TAB$1 && code !== R$1 && code !== N$1 && code !== F$1) {
    	            break;
    	        }
    	    }

    	    return offset;
    	}

    	function findCommentEnd(source, offset) {
    	    var commentEnd = source.indexOf('*/', offset);

    	    if (commentEnd === -1) {
    	        return source.length;
    	    }

    	    return commentEnd + 2;
    	}

    	function findStringEnd(source, offset, quote) {
    	    for (; offset < source.length; offset++) {
    	        var code = source.charCodeAt(offset);

    	        // TODO: bad string
    	        if (code === BACK_SLASH) {
    	            offset++;
    	        } else if (code === quote) {
    	            offset++;
    	            break;
    	        }
    	    }

    	    return offset;
    	}

    	function findDecimalNumberEnd(source, offset) {
    	    for (; offset < source.length; offset++) {
    	        var code = source.charCodeAt(offset);

    	        if (code < 48 || code > 57) {  // not a 0 .. 9
    	            break;
    	        }
    	    }

    	    return offset;
    	}

    	function findNumberEnd(source, offset, allowFraction) {
    	    var code;

    	    offset = findDecimalNumberEnd(source, offset);

    	    // fraction: .\d+
    	    if (allowFraction && offset + 1 < source.length && source.charCodeAt(offset) === FULLSTOP) {
    	        code = source.charCodeAt(offset + 1);

    	        if (isNumber(code)) {
    	            offset = findDecimalNumberEnd(source, offset + 1);
    	        }
    	    }

    	    // exponent: e[+-]\d+
    	    if (offset + 1 < source.length) {
    	        if ((source.charCodeAt(offset) | 32) === E) { // case insensitive check for `e`
    	            code = source.charCodeAt(offset + 1);

    	            if (code === PLUSSIGN || code === HYPHENMINUS) {
    	                if (offset + 2 < source.length) {
    	                    code = source.charCodeAt(offset + 2);
    	                }
    	            }

    	            if (isNumber(code)) {
    	                offset = findDecimalNumberEnd(source, offset + 2);
    	            }
    	        }
    	    }

    	    return offset;
    	}

    	// skip escaped unicode sequence that can ends with space
    	// [0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?
    	function findEscaseEnd(source, offset) {
    	    for (var i = 0; i < 7 && offset + i < source.length; i++) {
    	        var code = source.charCodeAt(offset + i);

    	        if (i !== 6 && isHex(code)) {
    	            continue;
    	        }

    	        if (i > 0) {
    	            offset += i - 1 + isNewline(source, offset + i, code);
    	            if (code === SPACE$1 || code === TAB$1) {
    	                offset++;
    	            }
    	        }

    	        break;
    	    }

    	    return offset;
    	}

    	function findIdentifierEnd(source, offset) {
    	    for (; offset < source.length; offset++) {
    	        var code = source.charCodeAt(offset);

    	        if (code === BACK_SLASH) {
    	            offset = findEscaseEnd(source, offset + 1);
    	        } else if (code < 0x80 && PUNCTUATION$1[code] === PUNCTUATOR$1) {
    	            break;
    	        }
    	    }

    	    return offset;
    	}

    	function findUrlRawEnd(source, offset) {
    	    for (; offset < source.length; offset++) {
    	        var code = source.charCodeAt(offset);

    	        if (code === BACK_SLASH) {
    	            offset = findEscaseEnd(source, offset + 1);
    	        } else if (code < 0x80 && STOP_URL_RAW$1[code] === 1) {
    	            break;
    	        }
    	    }

    	    return offset;
    	}

    	var utils = {
    	    firstCharOffset: firstCharOffset,

    	    isHex: isHex,
    	    isNumber: isNumber,
    	    isNewline: isNewline,

    	    cmpChar: cmpChar,
    	    cmpStr: cmpStr,
    	    endsWith: endsWith,

    	    findLastNonSpaceLocation: findLastNonSpaceLocation,
    	    findWhiteSpaceEnd: findWhiteSpaceEnd,
    	    findCommentEnd: findCommentEnd,
    	    findStringEnd: findStringEnd,
    	    findDecimalNumberEnd: findDecimalNumberEnd,
    	    findNumberEnd: findNumberEnd,
    	    findEscaseEnd: findEscaseEnd,
    	    findIdentifierEnd: findIdentifierEnd,
    	    findUrlRawEnd: findUrlRawEnd
    	};

    	var TYPE$2 = _const.TYPE;
    	var NAME$1 = _const.NAME;
    	var SYMBOL_TYPE$1 = _const.SYMBOL_TYPE;


    	var firstCharOffset$1 = utils.firstCharOffset;
    	var cmpStr$1 = utils.cmpStr;
    	var isNumber$1 = utils.isNumber;
    	var findLastNonSpaceLocation$1 = utils.findLastNonSpaceLocation;
    	var findWhiteSpaceEnd$1 = utils.findWhiteSpaceEnd;
    	var findCommentEnd$1 = utils.findCommentEnd;
    	var findStringEnd$1 = utils.findStringEnd;
    	var findNumberEnd$1 = utils.findNumberEnd;
    	var findIdentifierEnd$1 = utils.findIdentifierEnd;
    	var findUrlRawEnd$1 = utils.findUrlRawEnd;

    	var NULL = 0;
    	var WHITESPACE$1 = TYPE$2.WhiteSpace;
    	var IDENTIFIER$1 = TYPE$2.Identifier;
    	var NUMBER$1 = TYPE$2.Number;
    	var STRING$1 = TYPE$2.String;
    	var COMMENT$1 = TYPE$2.Comment;
    	var PUNCTUATOR$2 = TYPE$2.Punctuator;
    	var CDO$1 = TYPE$2.CDO;
    	var CDC$1 = TYPE$2.CDC;
    	var ATRULE$1 = TYPE$2.Atrule;
    	var FUNCTION$1 = TYPE$2.Function;
    	var URL$1 = TYPE$2.Url;
    	var RAW$1 = TYPE$2.Raw;

    	var N$2 = 10;
    	var F$2 = 12;
    	var R$2 = 13;
    	var STAR = TYPE$2.Asterisk;
    	var SLASH = TYPE$2.Solidus;
    	var FULLSTOP$1 = TYPE$2.FullStop;
    	var PLUSSIGN$1 = TYPE$2.PlusSign;
    	var HYPHENMINUS$1 = TYPE$2.HyphenMinus;
    	var GREATERTHANSIGN = TYPE$2.GreaterThanSign;
    	var LESSTHANSIGN = TYPE$2.LessThanSign;
    	var EXCLAMATIONMARK = TYPE$2.ExclamationMark;
    	var COMMERCIALAT = TYPE$2.CommercialAt;
    	var QUOTATIONMARK = TYPE$2.QuotationMark;
    	var APOSTROPHE = TYPE$2.Apostrophe;
    	var LEFTPARENTHESIS = TYPE$2.LeftParenthesis;
    	var RIGHTPARENTHESIS = TYPE$2.RightParenthesis;
    	var LEFTCURLYBRACKET = TYPE$2.LeftCurlyBracket;
    	var RIGHTCURLYBRACKET = TYPE$2.RightCurlyBracket;
    	var LEFTSQUAREBRACKET = TYPE$2.LeftSquareBracket;
    	var RIGHTSQUAREBRACKET = TYPE$2.RightSquareBracket;

    	var MIN_BUFFER_SIZE = 16 * 1024;
    	var OFFSET_MASK = 0x00FFFFFF;
    	var TYPE_SHIFT = 24;
    	var SafeUint32Array$1 = typeof Uint32Array !== 'undefined' ? Uint32Array : Array; // fallback on Array when TypedArray is not supported

    	function computeLinesAndColumns(tokenizer, source) {
    	    var sourceLength = source.length;
    	    var start = firstCharOffset$1(source);
    	    var lines = tokenizer.lines;
    	    var line = tokenizer.startLine;
    	    var columns = tokenizer.columns;
    	    var column = tokenizer.startColumn;

    	    if (lines === null || lines.length < sourceLength + 1) {
    	        lines = new SafeUint32Array$1(Math.max(sourceLength + 1024, MIN_BUFFER_SIZE));
    	        columns = new SafeUint32Array$1(lines.length);
    	    }

    	    for (var i = start; i < sourceLength; i++) {
    	        var code = source.charCodeAt(i);

    	        lines[i] = line;
    	        columns[i] = column++;

    	        if (code === N$2 || code === R$2 || code === F$2) {
    	            if (code === R$2 && i + 1 < sourceLength && source.charCodeAt(i + 1) === N$2) {
    	                i++;
    	                lines[i] = line;
    	                columns[i] = column;
    	            }

    	            line++;
    	            column = 1;
    	        }
    	    }

    	    lines[i] = line;
    	    columns[i] = column;

    	    tokenizer.linesAnsColumnsComputed = true;
    	    tokenizer.lines = lines;
    	    tokenizer.columns = columns;
    	}

    	function tokenLayout(tokenizer, source, startPos) {
    	    var sourceLength = source.length;
    	    var offsetAndType = tokenizer.offsetAndType;
    	    var balance = tokenizer.balance;
    	    var tokenCount = 0;
    	    var prevType = 0;
    	    var offset = startPos;
    	    var anchor = 0;
    	    var balanceCloseCode = 0;
    	    var balanceStart = 0;
    	    var balancePrev = 0;

    	    if (offsetAndType === null || offsetAndType.length < sourceLength + 1) {
    	        offsetAndType = new SafeUint32Array$1(sourceLength + 1024);
    	        balance = new SafeUint32Array$1(sourceLength + 1024);
    	    }

    	    while (offset < sourceLength) {
    	        var code = source.charCodeAt(offset);
    	        var type = code < 0x80 ? SYMBOL_TYPE$1[code] : IDENTIFIER$1;

    	        balance[tokenCount] = sourceLength;

    	        switch (type) {
    	            case WHITESPACE$1:
    	                offset = findWhiteSpaceEnd$1(source, offset + 1);
    	                break;

    	            case PUNCTUATOR$2:
    	                switch (code) {
    	                    case balanceCloseCode:
    	                        balancePrev = balanceStart & OFFSET_MASK;
    	                        balanceStart = balance[balancePrev];
    	                        balanceCloseCode = balanceStart >> TYPE_SHIFT;
    	                        balance[tokenCount] = balancePrev;
    	                        balance[balancePrev++] = tokenCount;
    	                        for (; balancePrev < tokenCount; balancePrev++) {
    	                            if (balance[balancePrev] === sourceLength) {
    	                                balance[balancePrev] = tokenCount;
    	                            }
    	                        }
    	                        break;

    	                    case LEFTSQUAREBRACKET:
    	                        balance[tokenCount] = balanceStart;
    	                        balanceCloseCode = RIGHTSQUAREBRACKET;
    	                        balanceStart = (balanceCloseCode << TYPE_SHIFT) | tokenCount;
    	                        break;

    	                    case LEFTCURLYBRACKET:
    	                        balance[tokenCount] = balanceStart;
    	                        balanceCloseCode = RIGHTCURLYBRACKET;
    	                        balanceStart = (balanceCloseCode << TYPE_SHIFT) | tokenCount;
    	                        break;

    	                    case LEFTPARENTHESIS:
    	                        balance[tokenCount] = balanceStart;
    	                        balanceCloseCode = RIGHTPARENTHESIS;
    	                        balanceStart = (balanceCloseCode << TYPE_SHIFT) | tokenCount;
    	                        break;
    	                }

    	                // /*
    	                if (code === STAR && prevType === SLASH) {
    	                    type = COMMENT$1;
    	                    offset = findCommentEnd$1(source, offset + 1);
    	                    tokenCount--; // rewrite prev token
    	                    break;
    	                }

    	                // edge case for -.123 and +.123
    	                if (code === FULLSTOP$1 && (prevType === PLUSSIGN$1 || prevType === HYPHENMINUS$1)) {
    	                    if (offset + 1 < sourceLength && isNumber$1(source.charCodeAt(offset + 1))) {
    	                        type = NUMBER$1;
    	                        offset = findNumberEnd$1(source, offset + 2, false);
    	                        tokenCount--; // rewrite prev token
    	                        break;
    	                    }
    	                }

    	                // <!--
    	                if (code === EXCLAMATIONMARK && prevType === LESSTHANSIGN) {
    	                    if (offset + 2 < sourceLength &&
    	                        source.charCodeAt(offset + 1) === HYPHENMINUS$1 &&
    	                        source.charCodeAt(offset + 2) === HYPHENMINUS$1) {
    	                        type = CDO$1;
    	                        offset = offset + 3;
    	                        tokenCount--; // rewrite prev token
    	                        break;
    	                    }
    	                }

    	                // -->
    	                if (code === HYPHENMINUS$1 && prevType === HYPHENMINUS$1) {
    	                    if (offset + 1 < sourceLength && source.charCodeAt(offset + 1) === GREATERTHANSIGN) {
    	                        type = CDC$1;
    	                        offset = offset + 2;
    	                        tokenCount--; // rewrite prev token
    	                        break;
    	                    }
    	                }

    	                // ident(
    	                if (code === LEFTPARENTHESIS && prevType === IDENTIFIER$1) {
    	                    offset = offset + 1;
    	                    tokenCount--; // rewrite prev token
    	                    balance[tokenCount] = balance[tokenCount + 1];
    	                    balanceStart--;

    	                    // 4 char length identifier and equal to `url(` (case insensitive)
    	                    if (offset - anchor === 4 && cmpStr$1(source, anchor, offset, 'url(')) {
    	                        // special case for url() because it can contain any symbols sequence with few exceptions
    	                        anchor = findWhiteSpaceEnd$1(source, offset);
    	                        code = source.charCodeAt(anchor);
    	                        if (code !== LEFTPARENTHESIS &&
    	                            code !== RIGHTPARENTHESIS &&
    	                            code !== QUOTATIONMARK &&
    	                            code !== APOSTROPHE) {
    	                            // url(
    	                            offsetAndType[tokenCount++] = (URL$1 << TYPE_SHIFT) | offset;
    	                            balance[tokenCount] = sourceLength;

    	                            // ws*
    	                            if (anchor !== offset) {
    	                                offsetAndType[tokenCount++] = (WHITESPACE$1 << TYPE_SHIFT) | anchor;
    	                                balance[tokenCount] = sourceLength;
    	                            }

    	                            // raw
    	                            type = RAW$1;
    	                            offset = findUrlRawEnd$1(source, anchor);
    	                        } else {
    	                            type = URL$1;
    	                        }
    	                    } else {
    	                        type = FUNCTION$1;
    	                    }
    	                    break;
    	                }

    	                type = code;
    	                offset = offset + 1;
    	                break;

    	            case NUMBER$1:
    	                offset = findNumberEnd$1(source, offset + 1, prevType !== FULLSTOP$1);

    	                // merge number with a preceding dot, dash or plus
    	                if (prevType === FULLSTOP$1 ||
    	                    prevType === HYPHENMINUS$1 ||
    	                    prevType === PLUSSIGN$1) {
    	                    tokenCount--; // rewrite prev token
    	                }

    	                break;

    	            case STRING$1:
    	                offset = findStringEnd$1(source, offset + 1, code);
    	                break;

    	            default:
    	                anchor = offset;
    	                offset = findIdentifierEnd$1(source, offset);

    	                // merge identifier with a preceding dash
    	                if (prevType === HYPHENMINUS$1) {
    	                    // rewrite prev token
    	                    tokenCount--;
    	                    // restore prev prev token type
    	                    // for case @-prefix-ident
    	                    prevType = tokenCount === 0 ? 0 : offsetAndType[tokenCount - 1] >> TYPE_SHIFT;
    	                }

    	                if (prevType === COMMERCIALAT) {
    	                    // rewrite prev token and change type to <at-keyword-token>
    	                    tokenCount--;
    	                    type = ATRULE$1;
    	                }
    	        }

    	        offsetAndType[tokenCount++] = (type << TYPE_SHIFT) | offset;
    	        prevType = type;
    	    }

    	    // finalize arrays
    	    offsetAndType[tokenCount] = offset;
    	    balance[tokenCount] = sourceLength;
    	    while (balanceStart !== 0) {
    	        balancePrev = balanceStart & OFFSET_MASK;
    	        balanceStart = balance[balancePrev];
    	        balance[balancePrev] = sourceLength;
    	    }

    	    tokenizer.offsetAndType = offsetAndType;
    	    tokenizer.tokenCount = tokenCount;
    	    tokenizer.balance = balance;
    	}

    	//
    	// tokenizer
    	//

    	var Tokenizer = function(source, startOffset, startLine, startColumn) {
    	    this.offsetAndType = null;
    	    this.balance = null;
    	    this.lines = null;
    	    this.columns = null;

    	    this.setSource(source, startOffset, startLine, startColumn);
    	};

    	Tokenizer.prototype = {
    	    setSource: function(source, startOffset, startLine, startColumn) {
    	        var safeSource = String(source || '');
    	        var start = firstCharOffset$1(safeSource);

    	        this.source = safeSource;
    	        this.firstCharOffset = start;
    	        this.startOffset = typeof startOffset === 'undefined' ? 0 : startOffset;
    	        this.startLine = typeof startLine === 'undefined' ? 1 : startLine;
    	        this.startColumn = typeof startColumn === 'undefined' ? 1 : startColumn;
    	        this.linesAnsColumnsComputed = false;

    	        this.eof = false;
    	        this.currentToken = -1;
    	        this.tokenType = 0;
    	        this.tokenStart = start;
    	        this.tokenEnd = start;

    	        tokenLayout(this, safeSource, start);
    	        this.next();
    	    },

    	    lookupType: function(offset) {
    	        offset += this.currentToken;

    	        if (offset < this.tokenCount) {
    	            return this.offsetAndType[offset] >> TYPE_SHIFT;
    	        }

    	        return NULL;
    	    },
    	    lookupNonWSType: function(offset) {
    	        offset += this.currentToken;

    	        for (var type; offset < this.tokenCount; offset++) {
    	            type = this.offsetAndType[offset] >> TYPE_SHIFT;

    	            if (type !== WHITESPACE$1) {
    	                return type;
    	            }
    	        }

    	        return NULL;
    	    },
    	    lookupValue: function(offset, referenceStr) {
    	        offset += this.currentToken;

    	        if (offset < this.tokenCount) {
    	            return cmpStr$1(
    	                this.source,
    	                this.offsetAndType[offset - 1] & OFFSET_MASK,
    	                this.offsetAndType[offset] & OFFSET_MASK,
    	                referenceStr
    	            );
    	        }

    	        return false;
    	    },
    	    getTokenStart: function(tokenNum) {
    	        if (tokenNum === this.currentToken) {
    	            return this.tokenStart;
    	        }

    	        if (tokenNum > 0) {
    	            return tokenNum < this.tokenCount
    	                ? this.offsetAndType[tokenNum - 1] & OFFSET_MASK
    	                : this.offsetAndType[this.tokenCount] & OFFSET_MASK;
    	        }

    	        return this.firstCharOffset;
    	    },
    	    getOffsetExcludeWS: function() {
    	        if (this.currentToken > 0) {
    	            if ((this.offsetAndType[this.currentToken - 1] >> TYPE_SHIFT) === WHITESPACE$1) {
    	                return this.currentToken > 1
    	                    ? this.offsetAndType[this.currentToken - 2] & OFFSET_MASK
    	                    : this.firstCharOffset;
    	            }
    	        }
    	        return this.tokenStart;
    	    },
    	    getRawLength: function(startToken, endTokenType1, endTokenType2, includeTokenType2) {
    	        var cursor = startToken;
    	        var balanceEnd;

    	        loop:
    	        for (; cursor < this.tokenCount; cursor++) {
    	            balanceEnd = this.balance[cursor];

    	            // belance end points to offset before start
    	            if (balanceEnd < startToken) {
    	                break loop;
    	            }

    	            // check token is stop type
    	            switch (this.offsetAndType[cursor] >> TYPE_SHIFT) {
    	                case endTokenType1:
    	                    break loop;

    	                case endTokenType2:
    	                    if (includeTokenType2) {
    	                        cursor++;
    	                    }
    	                    break loop;

    	                default:
    	                    // fast forward to the end of balanced block
    	                    if (this.balance[balanceEnd] === cursor) {
    	                        cursor = balanceEnd;
    	                    }
    	            }

    	        }

    	        return cursor - this.currentToken;
    	    },

    	    getTokenValue: function() {
    	        return this.source.substring(this.tokenStart, this.tokenEnd);
    	    },
    	    substrToCursor: function(start) {
    	        return this.source.substring(start, this.tokenStart);
    	    },

    	    skipWS: function() {
    	        for (var i = this.currentToken, skipTokenCount = 0; i < this.tokenCount; i++, skipTokenCount++) {
    	            if ((this.offsetAndType[i] >> TYPE_SHIFT) !== WHITESPACE$1) {
    	                break;
    	            }
    	        }

    	        if (skipTokenCount > 0) {
    	            this.skip(skipTokenCount);
    	        }
    	    },
    	    skipSC: function() {
    	        while (this.tokenType === WHITESPACE$1 || this.tokenType === COMMENT$1) {
    	            this.next();
    	        }
    	    },
    	    skip: function(tokenCount) {
    	        var next = this.currentToken + tokenCount;

    	        if (next < this.tokenCount) {
    	            this.currentToken = next;
    	            this.tokenStart = this.offsetAndType[next - 1] & OFFSET_MASK;
    	            next = this.offsetAndType[next];
    	            this.tokenType = next >> TYPE_SHIFT;
    	            this.tokenEnd = next & OFFSET_MASK;
    	        } else {
    	            this.currentToken = this.tokenCount;
    	            this.next();
    	        }
    	    },
    	    next: function() {
    	        var next = this.currentToken + 1;

    	        if (next < this.tokenCount) {
    	            this.currentToken = next;
    	            this.tokenStart = this.tokenEnd;
    	            next = this.offsetAndType[next];
    	            this.tokenType = next >> TYPE_SHIFT;
    	            this.tokenEnd = next & OFFSET_MASK;
    	        } else {
    	            this.currentToken = this.tokenCount;
    	            this.eof = true;
    	            this.tokenType = NULL;
    	            this.tokenStart = this.tokenEnd = this.source.length;
    	        }
    	    },

    	    eat: function(tokenType) {
    	        if (this.tokenType !== tokenType) {
    	            var offset = this.tokenStart;
    	            var message = NAME$1[tokenType] + ' is expected';

    	            // tweak message and offset
    	            if (tokenType === IDENTIFIER$1) {
    	                // when identifier is expected but there is a function or url
    	                if (this.tokenType === FUNCTION$1 || this.tokenType === URL$1) {
    	                    offset = this.tokenEnd - 1;
    	                    message += ' but function found';
    	                }
    	            } else {
    	                // when test type is part of another token show error for current position + 1
    	                // e.g. eat(HYPHENMINUS) will fail on "-foo", but pointing on "-" is odd
    	                if (this.source.charCodeAt(this.tokenStart) === tokenType) {
    	                    offset = offset + 1;
    	                }
    	            }

    	            this.error(message, offset);
    	        }

    	        this.next();
    	    },
    	    eatNonWS: function(tokenType) {
    	        this.skipWS();
    	        this.eat(tokenType);
    	    },

    	    consume: function(tokenType) {
    	        var value = this.getTokenValue();

    	        this.eat(tokenType);

    	        return value;
    	    },
    	    consumeFunctionName: function() {
    	        var name = this.source.substring(this.tokenStart, this.tokenEnd - 1);

    	        this.eat(FUNCTION$1);

    	        return name;
    	    },
    	    consumeNonWS: function(tokenType) {
    	        this.skipWS();

    	        return this.consume(tokenType);
    	    },

    	    expectIdentifier: function(name) {
    	        if (this.tokenType !== IDENTIFIER$1 || cmpStr$1(this.source, this.tokenStart, this.tokenEnd, name) === false) {
    	            this.error('Identifier `' + name + '` is expected');
    	        }

    	        this.next();
    	    },

    	    getLocation: function(offset, filename) {
    	        if (!this.linesAnsColumnsComputed) {
    	            computeLinesAndColumns(this, this.source);
    	        }

    	        return {
    	            source: filename,
    	            offset: this.startOffset + offset,
    	            line: this.lines[offset],
    	            column: this.columns[offset]
    	        };
    	    },

    	    getLocationRange: function(start, end, filename) {
    	        if (!this.linesAnsColumnsComputed) {
    	            computeLinesAndColumns(this, this.source);
    	        }

    	        return {
    	            source: filename,
    	            start: {
    	                offset: this.startOffset + start,
    	                line: this.lines[start],
    	                column: this.columns[start]
    	            },
    	            end: {
    	                offset: this.startOffset + end,
    	                line: this.lines[end],
    	                column: this.columns[end]
    	            }
    	        };
    	    },

    	    error: function(message, offset) {
    	        var location = typeof offset !== 'undefined' && offset < this.source.length
    	            ? this.getLocation(offset)
    	            : this.eof
    	                ? findLastNonSpaceLocation$1(this)
    	                : this.getLocation(this.tokenStart);

    	        throw new error(
    	            message || 'Unexpected input',
    	            this.source,
    	            location.offset,
    	            location.line,
    	            location.column
    	        );
    	    },

    	    dump: function() {
    	        var offset = 0;

    	        return Array.prototype.slice.call(this.offsetAndType, 0, this.tokenCount).map(function(item, idx) {
    	            var start = offset;
    	            var end = item & OFFSET_MASK;

    	            offset = end;

    	            return {
    	                idx: idx,
    	                type: NAME$1[item >> TYPE_SHIFT],
    	                chunk: this.source.substring(start, end),
    	                balance: this.balance[idx]
    	            };
    	        }, this);
    	    }
    	};

    	// extend with error class
    	Tokenizer.CssSyntaxError = error;

    	// extend tokenizer with constants
    	Object.keys(_const).forEach(function(key) {
    	    Tokenizer[key] = _const[key];
    	});

    	// extend tokenizer with static methods from utils
    	Object.keys(utils).forEach(function(key) {
    	    Tokenizer[key] = utils[key];
    	});

    	// warm up tokenizer to elimitate code branches that never execute
    	// fix soft deoptimizations (insufficient type feedback)
    	new Tokenizer('\n\r\r\n\f<!---->//""\'\'/*\r\n\f*/1a;.\\31\t\+2{url(a);func();+1.2e3 -.4e-5 .6e+7}').getLocation();

    	var Tokenizer_1 = Tokenizer;

    	var tokenizer = Tokenizer_1;

    	//
    	//            item        item        item        item
    	//          /------\    /------\    /------\    /------\
    	//          | data |    | data |    | data |    | data |
    	//  null <--+-prev |<---+-prev |<---+-prev |<---+-prev |
    	//          | next-+--->| next-+--->| next-+--->| next-+--> null
    	//          \------/    \------/    \------/    \------/
    	//             ^                                    ^
    	//             |                list                |
    	//             |              /------\              |
    	//             \--------------+-head |              |
    	//                            | tail-+--------------/
    	//                            \------/
    	//

    	function createItem(data) {
    	    return {
    	        prev: null,
    	        next: null,
    	        data: data
    	    };
    	}

    	var cursors = null;
    	var List = function() {
    	    this.cursor = null;
    	    this.head = null;
    	    this.tail = null;
    	};

    	List.createItem = createItem;
    	List.prototype.createItem = createItem;

    	List.prototype.getSize = function() {
    	    var size = 0;
    	    var cursor = this.head;

    	    while (cursor) {
    	        size++;
    	        cursor = cursor.next;
    	    }

    	    return size;
    	};

    	List.prototype.fromArray = function(array) {
    	    var cursor = null;

    	    this.head = null;

    	    for (var i = 0; i < array.length; i++) {
    	        var item = createItem(array[i]);

    	        if (cursor !== null) {
    	            cursor.next = item;
    	        } else {
    	            this.head = item;
    	        }

    	        item.prev = cursor;
    	        cursor = item;
    	    }

    	    this.tail = cursor;

    	    return this;
    	};

    	List.prototype.toArray = function() {
    	    var cursor = this.head;
    	    var result = [];

    	    while (cursor) {
    	        result.push(cursor.data);
    	        cursor = cursor.next;
    	    }

    	    return result;
    	};

    	List.prototype.toJSON = List.prototype.toArray;

    	List.prototype.isEmpty = function() {
    	    return this.head === null;
    	};

    	List.prototype.first = function() {
    	    return this.head && this.head.data;
    	};

    	List.prototype.last = function() {
    	    return this.tail && this.tail.data;
    	};

    	function allocateCursor(node, prev, next) {
    	    var cursor;

    	    if (cursors !== null) {
    	        cursor = cursors;
    	        cursors = cursors.cursor;
    	        cursor.prev = prev;
    	        cursor.next = next;
    	        cursor.cursor = node.cursor;
    	    } else {
    	        cursor = {
    	            prev: prev,
    	            next: next,
    	            cursor: node.cursor
    	        };
    	    }

    	    node.cursor = cursor;

    	    return cursor;
    	}

    	function releaseCursor(node) {
    	    var cursor = node.cursor;

    	    node.cursor = cursor.cursor;
    	    cursor.prev = null;
    	    cursor.next = null;
    	    cursor.cursor = cursors;
    	    cursors = cursor;
    	}

    	List.prototype.each = function(fn, context) {
    	    var item;

    	    if (context === undefined) {
    	        context = this;
    	    }

    	    // push cursor
    	    var cursor = allocateCursor(this, null, this.head);

    	    while (cursor.next !== null) {
    	        item = cursor.next;
    	        cursor.next = item.next;

    	        fn.call(context, item.data, item, this);
    	    }

    	    // pop cursor
    	    releaseCursor(this);
    	};

    	List.prototype.eachRight = function(fn, context) {
    	    var item;

    	    if (context === undefined) {
    	        context = this;
    	    }

    	    // push cursor
    	    var cursor = allocateCursor(this, this.tail, null);

    	    while (cursor.prev !== null) {
    	        item = cursor.prev;
    	        cursor.prev = item.prev;

    	        fn.call(context, item.data, item, this);
    	    }

    	    // pop cursor
    	    releaseCursor(this);
    	};

    	List.prototype.nextUntil = function(start, fn, context) {
    	    if (start === null) {
    	        return;
    	    }

    	    var item;

    	    if (context === undefined) {
    	        context = this;
    	    }

    	    // push cursor
    	    var cursor = allocateCursor(this, null, start);

    	    while (cursor.next !== null) {
    	        item = cursor.next;
    	        cursor.next = item.next;

    	        if (fn.call(context, item.data, item, this)) {
    	            break;
    	        }
    	    }

    	    // pop cursor
    	    releaseCursor(this);
    	};

    	List.prototype.prevUntil = function(start, fn, context) {
    	    if (start === null) {
    	        return;
    	    }

    	    var item;

    	    if (context === undefined) {
    	        context = this;
    	    }

    	    // push cursor
    	    var cursor = allocateCursor(this, start, null);

    	    while (cursor.prev !== null) {
    	        item = cursor.prev;
    	        cursor.prev = item.prev;

    	        if (fn.call(context, item.data, item, this)) {
    	            break;
    	        }
    	    }

    	    // pop cursor
    	    releaseCursor(this);
    	};

    	List.prototype.some = function(fn, context) {
    	    var cursor = this.head;

    	    if (context === undefined) {
    	        context = this;
    	    }

    	    while (cursor !== null) {
    	        if (fn.call(context, cursor.data, cursor, this)) {
    	            return true;
    	        }

    	        cursor = cursor.next;
    	    }

    	    return false;
    	};

    	List.prototype.map = function(fn, context) {
    	    var result = [];
    	    var cursor = this.head;

    	    if (context === undefined) {
    	        context = this;
    	    }

    	    while (cursor !== null) {
    	        result.push(fn.call(context, cursor.data, cursor, this));
    	        cursor = cursor.next;
    	    }

    	    return result;
    	};

    	List.prototype.clear = function() {
    	    this.head = null;
    	    this.tail = null;
    	};

    	List.prototype.copy = function() {
    	    var result = new List();
    	    var cursor = this.head;

    	    while (cursor !== null) {
    	        result.insert(createItem(cursor.data));
    	        cursor = cursor.next;
    	    }

    	    return result;
    	};

    	List.prototype.updateCursors = function(prevOld, prevNew, nextOld, nextNew) {
    	    var cursor = this.cursor;

    	    while (cursor !== null) {
    	        if (cursor.prev === prevOld) {
    	            cursor.prev = prevNew;
    	        }

    	        if (cursor.next === nextOld) {
    	            cursor.next = nextNew;
    	        }

    	        cursor = cursor.cursor;
    	    }
    	};

    	List.prototype.prepend = function(item) {
    	    //      head
    	    //    ^
    	    // item
    	    this.updateCursors(null, item, this.head, item);

    	    // insert to the beginning of the list
    	    if (this.head !== null) {
    	        // new item <- first item
    	        this.head.prev = item;

    	        // new item -> first item
    	        item.next = this.head;
    	    } else {
    	        // if list has no head, then it also has no tail
    	        // in this case tail points to the new item
    	        this.tail = item;
    	    }

    	    // head always points to new item
    	    this.head = item;

    	    return this;
    	};

    	List.prototype.prependData = function(data) {
    	    return this.prepend(createItem(data));
    	};

    	List.prototype.append = function(item) {
    	    // tail
    	    //      ^
    	    //      item
    	    this.updateCursors(this.tail, item, null, item);

    	    // insert to the ending of the list
    	    if (this.tail !== null) {
    	        // last item -> new item
    	        this.tail.next = item;

    	        // last item <- new item
    	        item.prev = this.tail;
    	    } else {
    	        // if list has no tail, then it also has no head
    	        // in this case head points to new item
    	        this.head = item;
    	    }

    	    // tail always points to new item
    	    this.tail = item;

    	    return this;
    	};

    	List.prototype.appendData = function(data) {
    	    return this.append(createItem(data));
    	};

    	List.prototype.insert = function(item, before) {
    	    if (before !== undefined && before !== null) {
    	        // prev   before
    	        //      ^
    	        //     item
    	        this.updateCursors(before.prev, item, before, item);

    	        if (before.prev === null) {
    	            // insert to the beginning of list
    	            if (this.head !== before) {
    	                throw new Error('before doesn\'t belong to list');
    	            }

    	            // since head points to before therefore list doesn't empty
    	            // no need to check tail
    	            this.head = item;
    	            before.prev = item;
    	            item.next = before;

    	            this.updateCursors(null, item);
    	        } else {

    	            // insert between two items
    	            before.prev.next = item;
    	            item.prev = before.prev;

    	            before.prev = item;
    	            item.next = before;
    	        }
    	    } else {
    	        this.append(item);
    	    }
    	};

    	List.prototype.insertData = function(data, before) {
    	    this.insert(createItem(data), before);
    	};

    	List.prototype.remove = function(item) {
    	    //      item
    	    //       ^
    	    // prev     next
    	    this.updateCursors(item, item.prev, item, item.next);

    	    if (item.prev !== null) {
    	        item.prev.next = item.next;
    	    } else {
    	        if (this.head !== item) {
    	            throw new Error('item doesn\'t belong to list');
    	        }

    	        this.head = item.next;
    	    }

    	    if (item.next !== null) {
    	        item.next.prev = item.prev;
    	    } else {
    	        if (this.tail !== item) {
    	            throw new Error('item doesn\'t belong to list');
    	        }

    	        this.tail = item.prev;
    	    }

    	    item.prev = null;
    	    item.next = null;

    	    return item;
    	};

    	List.prototype.appendList = function(list) {
    	    // ignore empty lists
    	    if (list.head === null) {
    	        return;
    	    }

    	    this.updateCursors(this.tail, list.tail, null, list.head);

    	    // insert to end of the list
    	    if (this.tail !== null) {
    	        // if destination list has a tail, then it also has a head,
    	        // but head doesn't change

    	        // dest tail -> source head
    	        this.tail.next = list.head;

    	        // dest tail <- source head
    	        list.head.prev = this.tail;
    	    } else {
    	        // if list has no a tail, then it also has no a head
    	        // in this case points head to new item
    	        this.head = list.head;
    	    }

    	    // tail always start point to new item
    	    this.tail = list.tail;

    	    list.head = null;
    	    list.tail = null;
    	};

    	List.prototype.insertList = function(list, before) {
    	    if (before !== undefined && before !== null) {
    	        // ignore empty lists
    	        if (list.head === null) {
    	            return;
    	        }

    	        this.updateCursors(before.prev, list.tail, before, list.head);

    	        // insert in the middle of dist list
    	        if (before.prev !== null) {
    	            // before.prev <-> list.head
    	            before.prev.next = list.head;
    	            list.head.prev = before.prev;
    	        } else {
    	            this.head = list.head;
    	        }

    	        before.prev = list.tail;
    	        list.tail.next = before;

    	        list.head = null;
    	        list.tail = null;
    	    } else {
    	        this.appendList(list);
    	    }
    	};

    	List.prototype.replace = function(oldItem, newItemOrList) {
    	    if ('head' in newItemOrList) {
    	        this.insertList(newItemOrList, oldItem);
    	    } else {
    	        this.insert(newItemOrList, oldItem);
    	    }
    	    this.remove(oldItem);
    	};

    	var list = List;

    	var TYPE$3 = tokenizer.TYPE;
    	var WHITESPACE$2 = TYPE$3.WhiteSpace;
    	var COMMENT$2 = TYPE$3.Comment;

    	var sequence = function readSequence(recognizer) {
    	    var children = new list();
    	    var child = null;
    	    var context = {
    	        recognizer: recognizer,
    	        space: null,
    	        ignoreWS: false,
    	        ignoreWSAfter: false
    	    };

    	    this.scanner.skipSC();

    	    while (!this.scanner.eof) {
    	        switch (this.scanner.tokenType) {
    	            case COMMENT$2:
    	                this.scanner.next();
    	                continue;

    	            case WHITESPACE$2:
    	                if (context.ignoreWS) {
    	                    this.scanner.next();
    	                } else {
    	                    context.space = this.WhiteSpace();
    	                }
    	                continue;
    	        }

    	        child = recognizer.getNode.call(this, context);

    	        if (child === undefined) {
    	            break;
    	        }

    	        if (context.space !== null) {
    	            children.appendData(context.space);
    	            context.space = null;
    	        }

    	        children.appendData(child);

    	        if (context.ignoreWSAfter) {
    	            context.ignoreWSAfter = false;
    	            context.ignoreWS = true;
    	        } else {
    	            context.ignoreWS = false;
    	        }
    	    }

    	    return children;
    	};

    	var noop = function() {};

    	function createParseContext(name) {
    	    return function() {
    	        return this[name]();
    	    };
    	}

    	function processConfig(config) {
    	    var parserConfig = {
    	        context: {},
    	        scope: {},
    	        atrule: {},
    	        pseudo: {}
    	    };

    	    if (config.parseContext) {
    	        for (var name in config.parseContext) {
    	            switch (typeof config.parseContext[name]) {
    	                case 'function':
    	                    parserConfig.context[name] = config.parseContext[name];
    	                    break;

    	                case 'string':
    	                    parserConfig.context[name] = createParseContext(config.parseContext[name]);
    	                    break;
    	            }
    	        }
    	    }

    	    if (config.scope) {
    	        for (var name in config.scope) {
    	            parserConfig.scope[name] = config.scope[name];
    	        }
    	    }

    	    if (config.atrule) {
    	        for (var name in config.atrule) {
    	            var atrule = config.atrule[name];

    	            if (atrule.parse) {
    	                parserConfig.atrule[name] = atrule.parse;
    	            }
    	        }
    	    }

    	    if (config.pseudo) {
    	        for (var name in config.pseudo) {
    	            var pseudo = config.pseudo[name];

    	            if (pseudo.parse) {
    	                parserConfig.pseudo[name] = pseudo.parse;
    	            }
    	        }
    	    }

    	    if (config.node) {
    	        for (var name in config.node) {
    	            parserConfig[name] = config.node[name].parse;
    	        }
    	    }

    	    return parserConfig;
    	}

    	var create = function createParser(config) {
    	    var parser = {
    	        scanner: new tokenizer(),
    	        filename: '<unknown>',
    	        needPositions: false,
    	        tolerant: false,
    	        onParseError: noop,
    	        parseAtruleExpression: true,
    	        parseSelector: true,
    	        parseValue: true,
    	        parseCustomProperty: false,

    	        readSequence: sequence,

    	        tolerantParse: function(consumer, fallback) {
    	            if (this.tolerant) {
    	                var start = this.scanner.currentToken;

    	                try {
    	                    return consumer.call(this);
    	                } catch (e) {
    	                    this.onParseError(e);
    	                    return fallback.call(this, start);
    	                }
    	            } else {
    	                return consumer.call(this);
    	            }
    	        },

    	        getLocation: function(start, end) {
    	            if (this.needPositions) {
    	                return this.scanner.getLocationRange(
    	                    start,
    	                    end,
    	                    this.filename
    	                );
    	            }

    	            return null;
    	        },
    	        getLocationFromList: function(list) {
    	            if (this.needPositions) {
    	                return this.scanner.getLocationRange(
    	                    list.head !== null ? list.first().loc.start.offset - this.scanner.startOffset : this.scanner.tokenStart,
    	                    list.head !== null ? list.last().loc.end.offset - this.scanner.startOffset : this.scanner.tokenStart,
    	                    this.filename
    	                );
    	            }

    	            return null;
    	        }
    	    };

    	    config = processConfig(config || {});
    	    for (var key in config) {
    	        parser[key] = config[key];
    	    }

    	    return function(source, options) {
    	        options = options || {};

    	        var context = options.context || 'default';
    	        var ast;

    	        parser.scanner.setSource(source, options.offset, options.line, options.column);
    	        parser.filename = options.filename || '<unknown>';
    	        parser.needPositions = Boolean(options.positions);
    	        parser.tolerant = Boolean(options.tolerant);
    	        parser.onParseError = typeof options.onParseError === 'function' ? options.onParseError : noop;
    	        parser.parseAtruleExpression = 'parseAtruleExpression' in options ? Boolean(options.parseAtruleExpression) : true;
    	        parser.parseSelector = 'parseSelector' in options ? Boolean(options.parseSelector) : true;
    	        parser.parseValue = 'parseValue' in options ? Boolean(options.parseValue) : true;
    	        parser.parseCustomProperty = 'parseCustomProperty' in options ? Boolean(options.parseCustomProperty) : false;

    	        if (!parser.context.hasOwnProperty(context)) {
    	            throw new Error('Unknown context `' + context + '`');
    	        }

    	        ast = parser.context[context].call(parser, options);

    	        if (!parser.scanner.eof) {
    	            parser.scanner.error();
    	        }

    	        // console.log(JSON.stringify(ast, null, 4));
    	        return ast;
    	    };
    	};

    	var cmpChar$1 = tokenizer.cmpChar;
    	var TYPE$4 = tokenizer.TYPE;

    	var IDENTIFIER$2 = TYPE$4.Identifier;
    	var STRING$2 = TYPE$4.String;
    	var NUMBER$2 = TYPE$4.Number;
    	var FUNCTION$2 = TYPE$4.Function;
    	var URL$2 = TYPE$4.Url;
    	var NUMBERSIGN = TYPE$4.NumberSign;
    	var LEFTPARENTHESIS$1 = TYPE$4.LeftParenthesis;
    	var LEFTSQUAREBRACKET$1 = TYPE$4.LeftSquareBracket;
    	var PLUSSIGN$2 = TYPE$4.PlusSign;
    	var HYPHENMINUS$2 = TYPE$4.HyphenMinus;
    	var COMMA = TYPE$4.Comma;
    	var SOLIDUS = TYPE$4.Solidus;
    	var ASTERISK = TYPE$4.Asterisk;
    	var PERCENTSIGN = TYPE$4.PercentSign;
    	var BACKSLASH = TYPE$4.Backslash;
    	var U = 117; // 'u'.charCodeAt(0)

    	var _default = function defaultRecognizer(context) {
    	    switch (this.scanner.tokenType) {
    	        case NUMBERSIGN:
    	            return this.HexColor();

    	        case COMMA:
    	            context.space = null;
    	            context.ignoreWSAfter = true;
    	            return this.Operator();

    	        case SOLIDUS:
    	        case ASTERISK:
    	        case PLUSSIGN$2:
    	        case HYPHENMINUS$2:
    	            return this.Operator();

    	        case LEFTPARENTHESIS$1:
    	            return this.Parentheses(this.readSequence, context.recognizer);

    	        case LEFTSQUAREBRACKET$1:
    	            return this.Brackets(this.readSequence, context.recognizer);

    	        case STRING$2:
    	            return this.String();

    	        case NUMBER$2:
    	            switch (this.scanner.lookupType(1)) {
    	                case PERCENTSIGN:
    	                    return this.Percentage();

    	                case IDENTIFIER$2:
    	                    // edge case: number with folowing \0 and \9 hack shouldn't to be a Dimension
    	                    if (cmpChar$1(this.scanner.source, this.scanner.tokenEnd, BACKSLASH)) {
    	                        return this.Number();
    	                    } else {
    	                        return this.Dimension();
    	                    }

    	                default:
    	                    return this.Number();
    	            }

    	        case FUNCTION$2:
    	            return this.Function(this.readSequence, context.recognizer);

    	        case URL$2:
    	            return this.Url();

    	        case IDENTIFIER$2:
    	            // check for unicode range, it should start with u+ or U+
    	            if (cmpChar$1(this.scanner.source, this.scanner.tokenStart, U) &&
    	                cmpChar$1(this.scanner.source, this.scanner.tokenStart + 1, PLUSSIGN$2)) {
    	                return this.UnicodeRange();
    	            } else {
    	                return this.Identifier();
    	            }
    	    }
    	};

    	var atruleExpression = {
    	    getNode: _default
    	};

    	var TYPE$5 = tokenizer.TYPE;

    	var IDENTIFIER$3 = TYPE$5.Identifier;
    	var NUMBER$3 = TYPE$5.Number;
    	var NUMBERSIGN$1 = TYPE$5.NumberSign;
    	var LEFTSQUAREBRACKET$2 = TYPE$5.LeftSquareBracket;
    	var PLUSSIGN$3 = TYPE$5.PlusSign;
    	var SOLIDUS$1 = TYPE$5.Solidus;
    	var ASTERISK$1 = TYPE$5.Asterisk;
    	var FULLSTOP$2 = TYPE$5.FullStop;
    	var COLON = TYPE$5.Colon;
    	var GREATERTHANSIGN$1 = TYPE$5.GreaterThanSign;
    	var VERTICALLINE = TYPE$5.VerticalLine;
    	var TILDE = TYPE$5.Tilde;

    	function getNode(context) {
    	    switch (this.scanner.tokenType) {
    	        case PLUSSIGN$3:
    	        case GREATERTHANSIGN$1:
    	        case TILDE:
    	            context.space = null;
    	            context.ignoreWSAfter = true;
    	            return this.Combinator();

    	        case SOLIDUS$1:  // /deep/
    	            return this.Combinator();

    	        case FULLSTOP$2:
    	            return this.ClassSelector();

    	        case LEFTSQUAREBRACKET$2:
    	            return this.AttributeSelector();

    	        case NUMBERSIGN$1:
    	            return this.IdSelector();

    	        case COLON:
    	            if (this.scanner.lookupType(1) === COLON) {
    	                return this.PseudoElementSelector();
    	            } else {
    	                return this.PseudoClassSelector();
    	            }

    	        case IDENTIFIER$3:
    	        case ASTERISK$1:
    	        case VERTICALLINE:
    	            return this.TypeSelector();

    	        case NUMBER$3:
    	            return this.Percentage();
    	    }
    	}
    	var selector = {
    	    getNode: getNode
    	};

    	// https://drafts.csswg.org/css-images-4/#element-notation
    	// https://developer.mozilla.org/en-US/docs/Web/CSS/element
    	var element = function() {
    	    this.scanner.skipSC();

    	    var id = this.IdSelector();

    	    this.scanner.skipSC();

    	    return new list().appendData(
    	        id
    	    );
    	};

    	// legacy IE function
    	// expression '(' raw ')'
    	var expression = function() {
    	    return new list().appendData(
    	        this.Raw(this.scanner.currentToken, 0, 0, false, false)
    	    );
    	};

    	var TYPE$6 = tokenizer.TYPE;

    	var IDENTIFIER$4 = TYPE$6.Identifier;
    	var COMMA$1 = TYPE$6.Comma;
    	var SEMICOLON = TYPE$6.Semicolon;
    	var HYPHENMINUS$3 = TYPE$6.HyphenMinus;
    	var EXCLAMATIONMARK$1 = TYPE$6.ExclamationMark;

    	// var '(' ident (',' <value>? )? ')'
    	var _var = function() {
    	    var children = new list();

    	    this.scanner.skipSC();

    	    var identStart = this.scanner.tokenStart;

    	    this.scanner.eat(HYPHENMINUS$3);
    	    if (this.scanner.source.charCodeAt(this.scanner.tokenStart) !== HYPHENMINUS$3) {
    	        this.scanner.error('HyphenMinus is expected');
    	    }
    	    this.scanner.eat(IDENTIFIER$4);

    	    children.appendData({
    	        type: 'Identifier',
    	        loc: this.getLocation(identStart, this.scanner.tokenStart),
    	        name: this.scanner.substrToCursor(identStart)
    	    });

    	    this.scanner.skipSC();

    	    if (this.scanner.tokenType === COMMA$1) {
    	        children.appendData(this.Operator());
    	        children.appendData(this.parseCustomProperty
    	            ? this.Value(null)
    	            : this.Raw(this.scanner.currentToken, EXCLAMATIONMARK$1, SEMICOLON, false, false)
    	        );
    	    }

    	    return children;
    	};

    	var value = {
    	    getNode: _default,
    	    '-moz-element': element,
    	    'element': element,
    	    'expression': expression,
    	    'var': _var
    	};

    	var scope = {
    	    AtruleExpression: atruleExpression,
    	    Selector: selector,
    	    Value: value
    	};

    	var fontFace = {
    	    parse: {
    	        expression: null,
    	        block: function() {
    	            return this.Block(this.Declaration);
    	        }
    	    }
    	};

    	var TYPE$7 = tokenizer.TYPE;

    	var STRING$3 = TYPE$7.String;
    	var IDENTIFIER$5 = TYPE$7.Identifier;
    	var URL$3 = TYPE$7.Url;
    	var LEFTPARENTHESIS$2 = TYPE$7.LeftParenthesis;

    	var _import = {
    	    parse: {
    	        expression: function() {
    	            var children = new list();

    	            this.scanner.skipSC();

    	            switch (this.scanner.tokenType) {
    	                case STRING$3:
    	                    children.appendData(this.String());
    	                    break;

    	                case URL$3:
    	                    children.appendData(this.Url());
    	                    break;

    	                default:
    	                    this.scanner.error('String or url() is expected');
    	            }

    	            if (this.scanner.lookupNonWSType(0) === IDENTIFIER$5 ||
    	                this.scanner.lookupNonWSType(0) === LEFTPARENTHESIS$2) {
    	                children.appendData(this.WhiteSpace());
    	                children.appendData(this.MediaQueryList());
    	            }

    	            return children;
    	        },
    	        block: null
    	    }
    	};

    	var media = {
    	    parse: {
    	        expression: function() {
    	            return new list().appendData(
    	                this.MediaQueryList()
    	            );
    	        },
    	        block: function() {
    	            return this.Block(this.Rule);
    	        }
    	    }
    	};

    	var TYPE$8 = tokenizer.TYPE;
    	var LEFTCURLYBRACKET$1 = TYPE$8.LeftCurlyBracket;

    	var page = {
    	    parse: {
    	        expression: function() {
    	            if (this.scanner.lookupNonWSType(0) === LEFTCURLYBRACKET$1) {
    	                return null;
    	            }

    	            return new list().appendData(
    	                this.SelectorList()
    	            );
    	        },
    	        block: function() {
    	            return this.Block(this.Declaration);
    	        }
    	    }
    	};

    	var TYPE$9 = tokenizer.TYPE;

    	var WHITESPACE$3 = TYPE$9.WhiteSpace;
    	var COMMENT$3 = TYPE$9.Comment;
    	var IDENTIFIER$6 = TYPE$9.Identifier;
    	var FUNCTION$3 = TYPE$9.Function;
    	var LEFTPARENTHESIS$3 = TYPE$9.LeftParenthesis;
    	var HYPHENMINUS$4 = TYPE$9.HyphenMinus;
    	var COLON$1 = TYPE$9.Colon;

    	function consumeRaw() {
    	    return new list().appendData(
    	        this.Raw(this.scanner.currentToken, 0, 0, false, false)
    	    );
    	}

    	function parentheses() {
    	    var index = 0;

    	    this.scanner.skipSC();

    	    // TODO: make it simplier
    	    if (this.scanner.tokenType === IDENTIFIER$6) {
    	        index = 1;
    	    } else if (this.scanner.tokenType === HYPHENMINUS$4 &&
    	               this.scanner.lookupType(1) === IDENTIFIER$6) {
    	        index = 2;
    	    }

    	    if (index !== 0 && this.scanner.lookupNonWSType(index) === COLON$1) {
    	        return new list().appendData(
    	            this.Declaration()
    	        );
    	    }

    	    return readSequence.call(this);
    	}

    	function readSequence() {
    	    var children = new list();
    	    var space = null;
    	    var child;

    	    this.scanner.skipSC();

    	    scan:
    	    while (!this.scanner.eof) {
    	        switch (this.scanner.tokenType) {
    	            case WHITESPACE$3:
    	                space = this.WhiteSpace();
    	                continue;

    	            case COMMENT$3:
    	                this.scanner.next();
    	                continue;

    	            case FUNCTION$3:
    	                child = this.Function(consumeRaw, this.scope.AtruleExpression);
    	                break;

    	            case IDENTIFIER$6:
    	                child = this.Identifier();
    	                break;

    	            case LEFTPARENTHESIS$3:
    	                child = this.Parentheses(parentheses, this.scope.AtruleExpression);
    	                break;

    	            default:
    	                break scan;
    	        }

    	        if (space !== null) {
    	            children.appendData(space);
    	            space = null;
    	        }

    	        children.appendData(child);
    	    }

    	    return children;
    	}

    	var supports = {
    	    parse: {
    	        expression: function() {
    	            var children = readSequence.call(this);

    	            if (children.isEmpty()) {
    	                this.scanner.error('Condition is expected');
    	            }

    	            return children;
    	        },
    	        block: function() {
    	            return this.Block(this.Rule);
    	        }
    	    }
    	};

    	var atrule = {
    	    'font-face': fontFace,
    	    'import': _import,
    	    'media': media,
    	    'page': page,
    	    'supports': supports
    	};

    	var dir = {
    	    parse: function() {
    	        return new list().appendData(
    	            this.Identifier()
    	        );
    	    }
    	};

    	var has$1 = {
    	    parse: function() {
    	        return new list().appendData(
    	            this.SelectorList()
    	        );
    	    }
    	};

    	var lang = {
    	    parse: function() {
    	        return new list().appendData(
    	            this.Identifier()
    	        );
    	    }
    	};

    	var selectorList = {
    	    parse: function selectorList() {
    	        return new list().appendData(
    	            this.SelectorList()
    	        );
    	    }
    	};

    	var matches = selectorList;

    	var not = selectorList;

    	var ALLOW_OF_CLAUSE = true;

    	var nthWithOfClause = {
    	    parse: function() {
    	        return new list().appendData(
    	            this.Nth(ALLOW_OF_CLAUSE)
    	        );
    	    }
    	};

    	var nthChild = nthWithOfClause;

    	var nthLastChild = nthWithOfClause;

    	var DISALLOW_OF_CLAUSE = false;

    	var nth = {
    	    parse: function nth() {
    	        return new list().appendData(
    	            this.Nth(DISALLOW_OF_CLAUSE)
    	        );
    	    }
    	};

    	var nthLastOfType = nth;

    	var nthOfType = nth;

    	var slotted = {
    	    parse: function compoundSelector() {
    	        return new list().appendData(
    	            this.Selector()
    	        );
    	    }
    	};

    	var pseudo = {
    	    'dir': dir,
    	    'has': has$1,
    	    'lang': lang,
    	    'matches': matches,
    	    'not': not,
    	    'nth-child': nthChild,
    	    'nth-last-child': nthLastChild,
    	    'nth-last-of-type': nthLastOfType,
    	    'nth-of-type': nthOfType,
    	    'slotted': slotted
    	};

    	var cmpChar$2 = tokenizer.cmpChar;
    	var isNumber$2 = tokenizer.isNumber;
    	var TYPE$a = tokenizer.TYPE;

    	var IDENTIFIER$7 = TYPE$a.Identifier;
    	var NUMBER$4 = TYPE$a.Number;
    	var PLUSSIGN$4 = TYPE$a.PlusSign;
    	var HYPHENMINUS$5 = TYPE$a.HyphenMinus;
    	var N$3 = 110; // 'n'.charCodeAt(0)
    	var DISALLOW_SIGN = true;
    	var ALLOW_SIGN = false;

    	function checkTokenIsInteger(scanner, disallowSign) {
    	    var pos = scanner.tokenStart;

    	    if (scanner.source.charCodeAt(pos) === PLUSSIGN$4 ||
    	        scanner.source.charCodeAt(pos) === HYPHENMINUS$5) {
    	        if (disallowSign) {
    	            scanner.error();
    	        }
    	        pos++;
    	    }

    	    for (; pos < scanner.tokenEnd; pos++) {
    	        if (!isNumber$2(scanner.source.charCodeAt(pos))) {
    	            scanner.error('Unexpected input', pos);
    	        }
    	    }
    	}

    	// An+B microsyntax https://www.w3.org/TR/css-syntax-3/#anb
    	var AnPlusB = {
    	    name: 'AnPlusB',
    	    structure: {
    	        a: [String, null],
    	        b: [String, null]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var end = start;
    	        var prefix = '';
    	        var a = null;
    	        var b = null;

    	        if (this.scanner.tokenType === NUMBER$4 ||
    	            this.scanner.tokenType === PLUSSIGN$4) {
    	            checkTokenIsInteger(this.scanner, ALLOW_SIGN);
    	            prefix = this.scanner.getTokenValue();
    	            this.scanner.next();
    	            end = this.scanner.tokenStart;
    	        }

    	        if (this.scanner.tokenType === IDENTIFIER$7) {
    	            var bStart = this.scanner.tokenStart;

    	            if (cmpChar$2(this.scanner.source, bStart, HYPHENMINUS$5)) {
    	                if (prefix === '') {
    	                    prefix = '-';
    	                    bStart++;
    	                } else {
    	                    this.scanner.error('Unexpected hyphen minus');
    	                }
    	            }

    	            if (!cmpChar$2(this.scanner.source, bStart, N$3)) {
    	                this.scanner.error();
    	            }

    	            a = prefix === ''  ? '1'  :
    	                prefix === '+' ? '+1' :
    	                prefix === '-' ? '-1' :
    	                prefix;

    	            var len = this.scanner.tokenEnd - bStart;
    	            if (len > 1) {
    	                // ..n-..
    	                if (this.scanner.source.charCodeAt(bStart + 1) !== HYPHENMINUS$5) {
    	                    this.scanner.error('Unexpected input', bStart + 1);
    	                }

    	                if (len > 2) {
    	                    // ..n-{number}..
    	                    this.scanner.tokenStart = bStart + 2;
    	                } else {
    	                    // ..n- {number}
    	                    this.scanner.next();
    	                    this.scanner.skipSC();
    	                }

    	                checkTokenIsInteger(this.scanner, DISALLOW_SIGN);
    	                b = '-' + this.scanner.getTokenValue();
    	                this.scanner.next();
    	                end = this.scanner.tokenStart;
    	            } else {
    	                prefix = '';
    	                this.scanner.next();
    	                end = this.scanner.tokenStart;
    	                this.scanner.skipSC();

    	                if (this.scanner.tokenType === HYPHENMINUS$5 ||
    	                    this.scanner.tokenType === PLUSSIGN$4) {
    	                    prefix = this.scanner.getTokenValue();
    	                    this.scanner.next();
    	                    this.scanner.skipSC();
    	                }

    	                if (this.scanner.tokenType === NUMBER$4) {
    	                    checkTokenIsInteger(this.scanner, prefix !== '');

    	                    if (!isNumber$2(this.scanner.source.charCodeAt(this.scanner.tokenStart))) {
    	                        prefix = this.scanner.source.charAt(this.scanner.tokenStart);
    	                        this.scanner.tokenStart++;
    	                    }

    	                    if (prefix === '') {
    	                        // should be an operator before number
    	                        this.scanner.error();
    	                    } else if (prefix === '+') {
    	                        // plus is using by default
    	                        prefix = '';
    	                    }

    	                    b = prefix + this.scanner.getTokenValue();

    	                    this.scanner.next();
    	                    end = this.scanner.tokenStart;
    	                } else {
    	                    if (prefix) {
    	                        this.scanner.eat(NUMBER$4);
    	                    }
    	                }
    	            }
    	        } else {
    	            if (prefix === '' || prefix === '+') { // no number
    	                this.scanner.error(
    	                    'Number or identifier is expected',
    	                    this.scanner.tokenStart + (
    	                        this.scanner.tokenType === PLUSSIGN$4 ||
    	                        this.scanner.tokenType === HYPHENMINUS$5
    	                    )
    	                );
    	            }

    	            b = prefix;
    	        }

    	        return {
    	            type: 'AnPlusB',
    	            loc: this.getLocation(start, end),
    	            a: a,
    	            b: b
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        var a = node.a !== null && node.a !== undefined;
    	        var b = node.b !== null && node.b !== undefined;

    	        if (a) {
    	            processChunk(
    	                node.a === '+1' ? '+n' :
    	                node.a ===  '1' ?  'n' :
    	                node.a === '-1' ? '-n' :
    	                node.a + 'n'
    	            );

    	            if (b) {
    	                b = String(node.b);
    	                if (b.charAt(0) === '-' || b.charAt(0) === '+') {
    	                    processChunk(b.charAt(0));
    	                    processChunk(b.substr(1));
    	                } else {
    	                    processChunk('+');
    	                    processChunk(b);
    	                }
    	            }
    	        } else {
    	            processChunk(String(node.b));
    	        }
    	    }
    	};

    	var TYPE$b = tokenizer.TYPE;

    	var ATRULE$2 = TYPE$b.Atrule;
    	var SEMICOLON$1 = TYPE$b.Semicolon;
    	var LEFTCURLYBRACKET$2 = TYPE$b.LeftCurlyBracket;
    	var RIGHTCURLYBRACKET$1 = TYPE$b.RightCurlyBracket;

    	function isBlockAtrule() {
    	    for (var offset = 1, type; type = this.scanner.lookupType(offset); offset++) {
    	        if (type === RIGHTCURLYBRACKET$1) {
    	            return true;
    	        }

    	        if (type === LEFTCURLYBRACKET$2 ||
    	            type === ATRULE$2) {
    	            return false;
    	        }
    	    }

    	    this.scanner.skip(offset);
    	    this.scanner.eat(RIGHTCURLYBRACKET$1);
    	}

    	var Atrule = {
    	    name: 'Atrule',
    	    structure: {
    	        name: String,
    	        expression: ['AtruleExpression', null],
    	        block: ['Block', null]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var name;
    	        var nameLowerCase;
    	        var expression = null;
    	        var block = null;

    	        this.scanner.eat(ATRULE$2);

    	        name = this.scanner.substrToCursor(start + 1);
    	        nameLowerCase = name.toLowerCase();
    	        this.scanner.skipSC();

    	        expression = this.AtruleExpression(name);

    	        // turn empty AtruleExpression into null
    	        if (expression.children.head === null) {
    	            expression = null;
    	        }

    	        this.scanner.skipSC();

    	        if (this.atrule.hasOwnProperty(nameLowerCase)) {
    	            if (typeof this.atrule[nameLowerCase].block === 'function') {
    	                if (this.scanner.tokenType !== LEFTCURLYBRACKET$2) {
    	                    // FIXME: make tolerant
    	                    this.scanner.error('Curly bracket is expected');
    	                }

    	                block = this.atrule[nameLowerCase].block.call(this);
    	            } else {
    	                if (!this.tolerant || !this.scanner.eof) {
    	                    this.scanner.eat(SEMICOLON$1);
    	                }
    	            }
    	        } else {
    	            switch (this.scanner.tokenType) {
    	                case SEMICOLON$1:
    	                    this.scanner.next();
    	                    break;

    	                case LEFTCURLYBRACKET$2:
    	                    // TODO: should consume block content as Raw?
    	                    block = this.Block(isBlockAtrule.call(this) ? this.Declaration : this.Rule);
    	                    break;

    	                default:
    	                    if (!this.tolerant) {
    	                        this.scanner.error('Semicolon or block is expected');
    	                    }
    	            }
    	        }

    	        return {
    	            type: 'Atrule',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: name,
    	            expression: expression,
    	            block: block
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('@');
    	        processChunk(node.name);

    	        if (node.expression !== null) {
    	            processChunk(' ');
    	            this.generate(processChunk, node.expression);
    	        }

    	        if (node.block) {
    	            this.generate(processChunk, node.block);
    	        } else {
    	            processChunk(';');
    	        }
    	    },
    	    walkContext: 'atrule'
    	};

    	var TYPE$c = tokenizer.TYPE;
    	var SEMICOLON$2 = TYPE$c.Semicolon;
    	var LEFTCURLYBRACKET$3 = TYPE$c.LeftCurlyBracket;

    	function consumeRaw$1(startToken) {
    	    return new list().appendData(
    	        this.Raw(startToken, SEMICOLON$2, LEFTCURLYBRACKET$3, false, true)
    	    );
    	}

    	function consumeDefaultSequence() {
    	    return this.readSequence(this.scope.AtruleExpression);
    	}

    	var AtruleExpression = {
    	    name: 'AtruleExpression',
    	    structure: {
    	        children: [[]]
    	    },
    	    parse: function(name) {
    	        var children = null;
    	        var startToken = this.scanner.currentToken;

    	        if (name !== null) {
    	            name = name.toLowerCase();
    	        }

    	        if (this.parseAtruleExpression) {
    	            // custom consumer
    	            if (this.atrule.hasOwnProperty(name)) {
    	                if (typeof this.atrule[name].expression === 'function') {
    	                    children = this.tolerantParse(this.atrule[name].expression, consumeRaw$1);
    	                }
    	            } else {
    	                // default consumer
    	                this.scanner.skipSC();
    	                children = this.tolerantParse(consumeDefaultSequence, consumeRaw$1);
    	            }

    	            if (this.tolerant) {
    	                if (this.scanner.eof || (this.scanner.tokenType !== SEMICOLON$2 && this.scanner.tokenType !== LEFTCURLYBRACKET$3)) {
    	                    children = consumeRaw$1.call(this, startToken);
    	                }
    	            }
    	        } else {
    	            children = consumeRaw$1.call(this, startToken);
    	        }

    	        if (children === null) {
    	            children = new list();
    	        }

    	        return {
    	            type: 'AtruleExpression',
    	            loc: this.getLocationFromList(children),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.each(processChunk, node);
    	    },
    	    walkContext: 'atruleExpression'
    	};

    	var TYPE$d = tokenizer.TYPE;

    	var IDENTIFIER$8 = TYPE$d.Identifier;
    	var STRING$4 = TYPE$d.String;
    	var DOLLARSIGN = TYPE$d.DollarSign;
    	var ASTERISK$2 = TYPE$d.Asterisk;
    	var COLON$2 = TYPE$d.Colon;
    	var EQUALSSIGN = TYPE$d.EqualsSign;
    	var LEFTSQUAREBRACKET$3 = TYPE$d.LeftSquareBracket;
    	var RIGHTSQUAREBRACKET$1 = TYPE$d.RightSquareBracket;
    	var CIRCUMFLEXACCENT = TYPE$d.CircumflexAccent;
    	var VERTICALLINE$1 = TYPE$d.VerticalLine;
    	var TILDE$1 = TYPE$d.Tilde;

    	function getAttributeName() {
    	    if (this.scanner.eof) {
    	        this.scanner.error('Unexpected end of input');
    	    }

    	    var start = this.scanner.tokenStart;
    	    var expectIdentifier = false;
    	    var checkColon = true;

    	    if (this.scanner.tokenType === ASTERISK$2) {
    	        expectIdentifier = true;
    	        checkColon = false;
    	        this.scanner.next();
    	    } else if (this.scanner.tokenType !== VERTICALLINE$1) {
    	        this.scanner.eat(IDENTIFIER$8);
    	    }

    	    if (this.scanner.tokenType === VERTICALLINE$1) {
    	        if (this.scanner.lookupType(1) !== EQUALSSIGN) {
    	            this.scanner.next();
    	            this.scanner.eat(IDENTIFIER$8);
    	        } else if (expectIdentifier) {
    	            this.scanner.error('Identifier is expected', this.scanner.tokenEnd);
    	        }
    	    } else if (expectIdentifier) {
    	        this.scanner.error('Vertical line is expected');
    	    }

    	    if (checkColon && this.scanner.tokenType === COLON$2) {
    	        this.scanner.next();
    	        this.scanner.eat(IDENTIFIER$8);
    	    }

    	    return {
    	        type: 'Identifier',
    	        loc: this.getLocation(start, this.scanner.tokenStart),
    	        name: this.scanner.substrToCursor(start)
    	    };
    	}

    	function getOperator() {
    	    var start = this.scanner.tokenStart;
    	    var tokenType = this.scanner.tokenType;

    	    if (tokenType !== EQUALSSIGN &&        // =
    	        tokenType !== TILDE$1 &&             // ~=
    	        tokenType !== CIRCUMFLEXACCENT &&  // ^=
    	        tokenType !== DOLLARSIGN &&        // $=
    	        tokenType !== ASTERISK$2 &&          // *=
    	        tokenType !== VERTICALLINE$1         // |=
    	    ) {
    	        this.scanner.error('Attribute selector (=, ~=, ^=, $=, *=, |=) is expected');
    	    }

    	    if (tokenType === EQUALSSIGN) {
    	        this.scanner.next();
    	    } else {
    	        this.scanner.next();
    	        this.scanner.eat(EQUALSSIGN);
    	    }

    	    return this.scanner.substrToCursor(start);
    	}

    	// '[' S* attrib_name ']'
    	// '[' S* attrib_name S* attrib_matcher S* [ IDENT | STRING ] S* attrib_flags? S* ']'
    	var AttributeSelector = {
    	    name: 'AttributeSelector',
    	    structure: {
    	        name: 'Identifier',
    	        matcher: [String, null],
    	        value: ['String', 'Identifier', null],
    	        flags: [String, null]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var name;
    	        var matcher = null;
    	        var value = null;
    	        var flags = null;

    	        this.scanner.eat(LEFTSQUAREBRACKET$3);
    	        this.scanner.skipSC();

    	        name = getAttributeName.call(this);
    	        this.scanner.skipSC();

    	        if (this.scanner.tokenType !== RIGHTSQUAREBRACKET$1) {
    	            // avoid case `[name i]`
    	            if (this.scanner.tokenType !== IDENTIFIER$8) {
    	                matcher = getOperator.call(this);

    	                this.scanner.skipSC();

    	                value = this.scanner.tokenType === STRING$4
    	                    ? this.String()
    	                    : this.Identifier();

    	                this.scanner.skipSC();
    	            }

    	            // attribute flags
    	            if (this.scanner.tokenType === IDENTIFIER$8) {
    	                flags = this.scanner.getTokenValue();
    	                this.scanner.next();

    	                this.scanner.skipSC();
    	            }
    	        }

    	        this.scanner.eat(RIGHTSQUAREBRACKET$1);

    	        return {
    	            type: 'AttributeSelector',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: name,
    	            matcher: matcher,
    	            value: value,
    	            flags: flags
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        var flagsPrefix = ' ';

    	        processChunk('[');
    	        this.generate(processChunk, node.name);

    	        if (node.matcher !== null) {
    	            processChunk(node.matcher);

    	            if (node.value !== null) {
    	                this.generate(processChunk, node.value);

    	                // space between string and flags is not required
    	                if (node.value.type === 'String') {
    	                    flagsPrefix = '';
    	                }
    	            }
    	        }

    	        if (node.flags !== null) {
    	            processChunk(flagsPrefix);
    	            processChunk(node.flags);
    	        }

    	        processChunk(']');
    	    }
    	};

    	var TYPE$e = tokenizer.TYPE;

    	var WHITESPACE$4 = TYPE$e.WhiteSpace;
    	var COMMENT$4 = TYPE$e.Comment;
    	var SEMICOLON$3 = TYPE$e.Semicolon;
    	var ATRULE$3 = TYPE$e.Atrule;
    	var LEFTCURLYBRACKET$4 = TYPE$e.LeftCurlyBracket;
    	var RIGHTCURLYBRACKET$2 = TYPE$e.RightCurlyBracket;

    	function consumeRaw$2(startToken) {
    	    return this.Raw(startToken, 0, SEMICOLON$3, true, true);
    	}

    	var Block = {
    	    name: 'Block',
    	    structure: {
    	        children: [['Atrule', 'Rule', 'Declaration']]
    	    },
    	    parse: function(defaultConsumer) {
    	        if (!defaultConsumer) {
    	            defaultConsumer = this.Declaration;
    	        }

    	        var start = this.scanner.tokenStart;
    	        var children = new list();

    	        this.scanner.eat(LEFTCURLYBRACKET$4);

    	        scan:
    	        while (!this.scanner.eof) {
    	            switch (this.scanner.tokenType) {
    	                case RIGHTCURLYBRACKET$2:
    	                    break scan;

    	                case WHITESPACE$4:
    	                case COMMENT$4:
    	                case SEMICOLON$3:
    	                    this.scanner.next();
    	                    break;

    	                case ATRULE$3:
    	                    children.appendData(this.tolerantParse(this.Atrule, consumeRaw$2));
    	                    break;

    	                default:
    	                    children.appendData(this.tolerantParse(defaultConsumer, consumeRaw$2));
    	            }
    	        }

    	        if (!this.tolerant || !this.scanner.eof) {
    	            this.scanner.eat(RIGHTCURLYBRACKET$2);
    	        }

    	        return {
    	            type: 'Block',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('{');
    	        this.each(processChunk, node);
    	        processChunk('}');
    	    },
    	    walkContext: 'block'
    	};

    	var TYPE$f = tokenizer.TYPE;
    	var LEFTSQUAREBRACKET$4 = TYPE$f.LeftSquareBracket;
    	var RIGHTSQUAREBRACKET$2 = TYPE$f.RightSquareBracket;

    	// currently only Grid Layout uses square brackets, but left it universal
    	// https://drafts.csswg.org/css-grid/#track-sizing
    	// [ ident* ]
    	var Brackets = {
    	    name: 'Brackets',
    	    structure: {
    	        children: [[]]
    	    },
    	    parse: function(readSequence, recognizer) {
    	        var start = this.scanner.tokenStart;
    	        var children = null;

    	        this.scanner.eat(LEFTSQUAREBRACKET$4);
    	        children = readSequence.call(this, recognizer);
    	        this.scanner.eat(RIGHTSQUAREBRACKET$2);

    	        return {
    	            type: 'Brackets',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('[');
    	        this.each(processChunk, node);
    	        processChunk(']');
    	    }
    	};

    	var CDC$2 = tokenizer.TYPE.CDC;

    	var CDC_1 = {
    	    name: 'CDC',
    	    structure: [],
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        this.scanner.eat(CDC$2); // -->

    	        return {
    	            type: 'CDC',
    	            loc: this.getLocation(start, this.scanner.tokenStart)
    	        };
    	    },
    	    generate: function(processChunk) {
    	        processChunk('-->');
    	    }
    	};

    	var CDO$2 = tokenizer.TYPE.CDO;

    	var CDO_1 = {
    	    name: 'CDO',
    	    structure: [],
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        this.scanner.eat(CDO$2); // <!--

    	        return {
    	            type: 'CDO',
    	            loc: this.getLocation(start, this.scanner.tokenStart)
    	        };
    	    },
    	    generate: function(processChunk) {
    	        processChunk('<!--');
    	    }
    	};

    	var TYPE$g = tokenizer.TYPE;
    	var IDENTIFIER$9 = TYPE$g.Identifier;
    	var FULLSTOP$3 = TYPE$g.FullStop;

    	// '.' ident
    	var ClassSelector = {
    	    name: 'ClassSelector',
    	    structure: {
    	        name: String
    	    },
    	    parse: function() {
    	        this.scanner.eat(FULLSTOP$3);

    	        return {
    	            type: 'ClassSelector',
    	            loc: this.getLocation(this.scanner.tokenStart - 1, this.scanner.tokenEnd),
    	            name: this.scanner.consume(IDENTIFIER$9)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('.');
    	        processChunk(node.name);
    	    }
    	};

    	var TYPE$h = tokenizer.TYPE;

    	var PLUSSIGN$5 = TYPE$h.PlusSign;
    	var SOLIDUS$2 = TYPE$h.Solidus;
    	var GREATERTHANSIGN$2 = TYPE$h.GreaterThanSign;
    	var TILDE$2 = TYPE$h.Tilde;

    	// + | > | ~ | /deep/
    	var Combinator = {
    	    name: 'Combinator',
    	    structure: {
    	        name: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        switch (this.scanner.tokenType) {
    	            case GREATERTHANSIGN$2:
    	            case PLUSSIGN$5:
    	            case TILDE$2:
    	                this.scanner.next();
    	                break;

    	            case SOLIDUS$2:
    	                this.scanner.next();
    	                this.scanner.expectIdentifier('deep');
    	                this.scanner.eat(SOLIDUS$2);
    	                break;

    	            default:
    	                this.scanner.error('Combinator is expected');
    	        }

    	        return {
    	            type: 'Combinator',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: this.scanner.substrToCursor(start)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.name);
    	    }
    	};

    	var TYPE$i = tokenizer.TYPE;

    	var ASTERISK$3 = TYPE$i.Asterisk;
    	var SOLIDUS$3 = TYPE$i.Solidus;

    	// '/*' .* '*/'
    	var Comment = {
    	    name: 'Comment',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var end = this.scanner.tokenEnd;

    	        if ((end - start + 2) >= 2 &&
    	            this.scanner.source.charCodeAt(end - 2) === ASTERISK$3 &&
    	            this.scanner.source.charCodeAt(end - 1) === SOLIDUS$3) {
    	            end -= 2;
    	        }

    	        this.scanner.next();

    	        return {
    	            type: 'Comment',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: this.scanner.source.substring(start + 2, end)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('/*');
    	        processChunk(node.value);
    	        processChunk('*/');
    	    }
    	};

    	var TYPE$j = tokenizer.TYPE;

    	var IDENTIFIER$a = TYPE$j.Identifier;
    	var COLON$3 = TYPE$j.Colon;
    	var EXCLAMATIONMARK$2 = TYPE$j.ExclamationMark;
    	var SOLIDUS$4 = TYPE$j.Solidus;
    	var ASTERISK$4 = TYPE$j.Asterisk;
    	var DOLLARSIGN$1 = TYPE$j.DollarSign;
    	var HYPHENMINUS$6 = TYPE$j.HyphenMinus;
    	var SEMICOLON$4 = TYPE$j.Semicolon;
    	var RIGHTCURLYBRACKET$3 = TYPE$j.RightCurlyBracket;
    	var RIGHTPARENTHESIS$1 = TYPE$j.RightParenthesis;
    	var PLUSSIGN$6 = TYPE$j.PlusSign;
    	var NUMBERSIGN$2 = TYPE$j.NumberSign;

    	var Declaration = {
    	    name: 'Declaration',
    	    structure: {
    	        important: [Boolean, String],
    	        property: String,
    	        value: ['Value', 'Raw']
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var property = readProperty.call(this);
    	        var important = false;
    	        var value;

    	        this.scanner.skipSC();
    	        this.scanner.eat(COLON$3);

    	        if (isCustomProperty(property) ? this.parseCustomProperty : this.parseValue) {
    	            value = this.Value(property);
    	        } else {
    	            value = this.Raw(this.scanner.currentToken, EXCLAMATIONMARK$2, SEMICOLON$4, false, false);
    	        }

    	        if (this.scanner.tokenType === EXCLAMATIONMARK$2) {
    	            important = getImportant(this.scanner);
    	            this.scanner.skipSC();
    	        }

    	        // TODO: include or not to include semicolon to range?
    	        // if (this.scanner.tokenType === SEMICOLON) {
    	        //     this.scanner.next();
    	        // }

    	        if (!this.scanner.eof &&
    	            this.scanner.tokenType !== SEMICOLON$4 &&
    	            this.scanner.tokenType !== RIGHTPARENTHESIS$1 &&
    	            this.scanner.tokenType !== RIGHTCURLYBRACKET$3) {
    	            this.scanner.error();
    	        }

    	        return {
    	            type: 'Declaration',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            important: important,
    	            property: property,
    	            value: value
    	        };
    	    },
    	    generate: function(processChunk, node, item) {
    	        processChunk(node.property);
    	        processChunk(':');
    	        this.generate(processChunk, node.value);

    	        if (node.important) {
    	            processChunk(node.important === true ? '!important' : '!' + node.important);
    	        }

    	        if (item && item.next) {
    	            processChunk(';');
    	        }
    	    },
    	    walkContext: 'declaration'
    	};

    	function isCustomProperty(name) {
    	    return name.length >= 2 &&
    	           name.charCodeAt(0) === HYPHENMINUS$6 &&
    	           name.charCodeAt(1) === HYPHENMINUS$6;
    	}

    	function readProperty() {
    	    var start = this.scanner.tokenStart;
    	    var prefix = 0;

    	    // hacks
    	    switch (this.scanner.tokenType) {
    	        case ASTERISK$4:
    	        case DOLLARSIGN$1:
    	        case PLUSSIGN$6:
    	        case NUMBERSIGN$2:
    	            prefix = 1;
    	            break;

    	        // TODO: not sure we should support this hack
    	        case SOLIDUS$4:
    	            prefix = this.scanner.lookupType(1) === SOLIDUS$4 ? 2 : 1;
    	            break;
    	    }

    	    if (this.scanner.lookupType(prefix) === HYPHENMINUS$6) {
    	        prefix++;
    	    }

    	    if (prefix) {
    	        this.scanner.skip(prefix);
    	    }

    	    this.scanner.eat(IDENTIFIER$a);

    	    return this.scanner.substrToCursor(start);
    	}

    	// ! ws* important
    	function getImportant(scanner) {
    	    scanner.eat(EXCLAMATIONMARK$2);
    	    scanner.skipSC();

    	    var important = scanner.consume(IDENTIFIER$a);

    	    // store original value in case it differ from `important`
    	    // for better original source restoring and hacks like `!ie` support
    	    return important === 'important' ? true : important;
    	}

    	var TYPE$k = tokenizer.TYPE;

    	var WHITESPACE$5 = TYPE$k.WhiteSpace;
    	var COMMENT$5 = TYPE$k.Comment;
    	var SEMICOLON$5 = TYPE$k.Semicolon;

    	function consumeRaw$3(startToken) {
    	    return this.Raw(startToken, 0, SEMICOLON$5, true, true);
    	}

    	var DeclarationList = {
    	    name: 'DeclarationList',
    	    structure: {
    	        children: [['Declaration']]
    	    },
    	    parse: function() {
    	        var children = new list();

    	        
    	        while (!this.scanner.eof) {
    	            switch (this.scanner.tokenType) {
    	                case WHITESPACE$5:
    	                case COMMENT$5:
    	                case SEMICOLON$5:
    	                    this.scanner.next();
    	                    break;

    	                default:
    	                    children.appendData(this.tolerantParse(this.Declaration, consumeRaw$3));
    	            }
    	        }

    	        return {
    	            type: 'DeclarationList',
    	            loc: this.getLocationFromList(children),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.each(processChunk, node);
    	    }
    	};

    	var NUMBER$5 = tokenizer.TYPE.Number;

    	// special reader for units to avoid adjoined IE hacks (i.e. '1px\9')
    	function readUnit(scanner) {
    	    var unit = scanner.getTokenValue();
    	    var backSlashPos = unit.indexOf('\\');

    	    if (backSlashPos > 0) {
    	        // patch token offset
    	        scanner.tokenStart += backSlashPos;

    	        // return part before backslash
    	        return unit.substring(0, backSlashPos);
    	    }

    	    // no backslash in unit name
    	    scanner.next();

    	    return unit;
    	}

    	// number ident
    	var Dimension = {
    	    name: 'Dimension',
    	    structure: {
    	        value: String,
    	        unit: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var value = this.scanner.consume(NUMBER$5);
    	        var unit = readUnit(this.scanner);

    	        return {
    	            type: 'Dimension',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: value,
    	            unit: unit
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	        processChunk(node.unit);
    	    }
    	};

    	var TYPE$l = tokenizer.TYPE;
    	var RIGHTPARENTHESIS$2 = TYPE$l.RightParenthesis;

    	// <function-token> <sequence> ')'
    	var _Function = {
    	    name: 'Function',
    	    structure: {
    	        name: String,
    	        children: [[]]
    	    },
    	    parse: function(readSequence, recognizer) {
    	        var start = this.scanner.tokenStart;
    	        var name = this.scanner.consumeFunctionName();
    	        var nameLowerCase = name.toLowerCase();
    	        var children;

    	        children = recognizer.hasOwnProperty(nameLowerCase)
    	            ? recognizer[nameLowerCase].call(this, recognizer)
    	            : readSequence.call(this, recognizer);

    	        this.scanner.eat(RIGHTPARENTHESIS$2);

    	        return {
    	            type: 'Function',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: name,
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.name);
    	        processChunk('(');
    	        this.each(processChunk, node);
    	        processChunk(')');
    	    },
    	    walkContext: 'function'
    	};

    	var isHex$1 = tokenizer.isHex;
    	var TYPE$m = tokenizer.TYPE;

    	var IDENTIFIER$b = TYPE$m.Identifier;
    	var NUMBER$6 = TYPE$m.Number;
    	var NUMBERSIGN$3 = TYPE$m.NumberSign;

    	function consumeHexSequence(scanner, required) {
    	    if (!isHex$1(scanner.source.charCodeAt(scanner.tokenStart))) {
    	        if (required) {
    	            scanner.error('Unexpected input', scanner.tokenStart);
    	        } else {
    	            return;
    	        }
    	    }

    	    for (var pos = scanner.tokenStart + 1; pos < scanner.tokenEnd; pos++) {
    	        var code = scanner.source.charCodeAt(pos);

    	        // break on non-hex char
    	        if (!isHex$1(code)) {
    	            // break token, exclude symbol
    	            scanner.tokenStart = pos;
    	            return;
    	        }
    	    }

    	    // token is full hex sequence, go to next token
    	    scanner.next();
    	}

    	// # ident
    	var HexColor = {
    	    name: 'HexColor',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        this.scanner.eat(NUMBERSIGN$3);

    	        
    	        switch (this.scanner.tokenType) {
    	            case NUMBER$6:
    	                consumeHexSequence(this.scanner, true);

    	                // if token is identifier then number consists of hex only,
    	                // try to add identifier to result
    	                if (this.scanner.tokenType === IDENTIFIER$b) {
    	                    consumeHexSequence(this.scanner, false);
    	                }

    	                break;

    	            case IDENTIFIER$b:
    	                consumeHexSequence(this.scanner, true);
    	                break;

    	            default:
    	                this.scanner.error('Number or identifier is expected');
    	        }

    	        return {
    	            type: 'HexColor',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: this.scanner.substrToCursor(start + 1) // skip #
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('#');
    	        processChunk(node.value);
    	    }
    	};

    	var TYPE$n = tokenizer.TYPE;
    	var IDENTIFIER$c = TYPE$n.Identifier;

    	var Identifier = {
    	    name: 'Identifier',
    	    structure: {
    	        name: String
    	    },
    	    parse: function() {
    	        return {
    	            type: 'Identifier',
    	            loc: this.getLocation(this.scanner.tokenStart, this.scanner.tokenEnd),
    	            name: this.scanner.consume(IDENTIFIER$c)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.name);
    	    }
    	};

    	var TYPE$o = tokenizer.TYPE;
    	var IDENTIFIER$d = TYPE$o.Identifier;
    	var NUMBERSIGN$4 = TYPE$o.NumberSign;

    	// '#' ident
    	var IdSelector = {
    	    name: 'IdSelector',
    	    structure: {
    	        name: String
    	    },
    	    parse: function() {
    	        this.scanner.eat(NUMBERSIGN$4);

    	        return {
    	            type: 'IdSelector',
    	            loc: this.getLocation(this.scanner.tokenStart - 1, this.scanner.tokenEnd),
    	            name: this.scanner.consume(IDENTIFIER$d)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('#');
    	        processChunk(node.name);
    	    }
    	};

    	var TYPE$p = tokenizer.TYPE;

    	var IDENTIFIER$e = TYPE$p.Identifier;
    	var NUMBER$7 = TYPE$p.Number;
    	var LEFTPARENTHESIS$4 = TYPE$p.LeftParenthesis;
    	var RIGHTPARENTHESIS$3 = TYPE$p.RightParenthesis;
    	var COLON$4 = TYPE$p.Colon;
    	var SOLIDUS$5 = TYPE$p.Solidus;

    	var MediaFeature = {
    	    name: 'MediaFeature',
    	    structure: {
    	        name: String,
    	        value: ['Identifier', 'Number', 'Dimension', 'Ratio', null]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var name;
    	        var value = null;

    	        this.scanner.eat(LEFTPARENTHESIS$4);
    	        this.scanner.skipSC();

    	        name = this.scanner.consume(IDENTIFIER$e);
    	        this.scanner.skipSC();

    	        if (this.scanner.tokenType !== RIGHTPARENTHESIS$3) {
    	            this.scanner.eat(COLON$4);
    	            this.scanner.skipSC();

    	            switch (this.scanner.tokenType) {
    	                case NUMBER$7:
    	                    if (this.scanner.lookupType(1) === IDENTIFIER$e) {
    	                        value = this.Dimension();
    	                    } else if (this.scanner.lookupNonWSType(1) === SOLIDUS$5) {
    	                        value = this.Ratio();
    	                    } else {
    	                        value = this.Number();
    	                    }

    	                    break;

    	                case IDENTIFIER$e:
    	                    value = this.Identifier();

    	                    break;

    	                default:
    	                    this.scanner.error('Number, dimension, ratio or identifier is expected');
    	            }

    	            this.scanner.skipSC();
    	        }

    	        this.scanner.eat(RIGHTPARENTHESIS$3);

    	        return {
    	            type: 'MediaFeature',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: name,
    	            value: value
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('(');
    	        processChunk(node.name);
    	        if (node.value !== null) {
    	            processChunk(':');
    	            this.generate(processChunk, node.value);
    	        }
    	        processChunk(')');
    	    }
    	};

    	var TYPE$q = tokenizer.TYPE;

    	var WHITESPACE$6 = TYPE$q.WhiteSpace;
    	var COMMENT$6 = TYPE$q.Comment;
    	var IDENTIFIER$f = TYPE$q.Identifier;
    	var LEFTPARENTHESIS$5 = TYPE$q.LeftParenthesis;

    	var MediaQuery = {
    	    name: 'MediaQuery',
    	    structure: {
    	        children: [['Identifier', 'MediaFeature', 'WhiteSpace']]
    	    },
    	    parse: function() {
    	        this.scanner.skipSC();

    	        var children = new list();
    	        var child = null;
    	        var space = null;

    	        scan:
    	        while (!this.scanner.eof) {
    	            switch (this.scanner.tokenType) {
    	                case COMMENT$6:
    	                    this.scanner.next();
    	                    continue;

    	                case WHITESPACE$6:
    	                    space = this.WhiteSpace();
    	                    continue;

    	                case IDENTIFIER$f:
    	                    child = this.Identifier();
    	                    break;

    	                case LEFTPARENTHESIS$5:
    	                    child = this.MediaFeature();
    	                    break;

    	                default:
    	                    break scan;
    	            }

    	            if (space !== null) {
    	                children.appendData(space);
    	                space = null;
    	            }

    	            children.appendData(child);
    	        }

    	        if (child === null) {
    	            this.scanner.error('Identifier or parenthesis is expected');
    	        }

    	        return {
    	            type: 'MediaQuery',
    	            loc: this.getLocationFromList(children),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.each(processChunk, node);
    	    }
    	};

    	var COMMA$2 = tokenizer.TYPE.Comma;

    	var MediaQueryList = {
    	    name: 'MediaQueryList',
    	    structure: {
    	        children: [['MediaQuery']]
    	    },
    	    parse: function(relative) {
    	        var children = new list();

    	        this.scanner.skipSC();

    	        while (!this.scanner.eof) {
    	            children.appendData(this.MediaQuery(relative));

    	            if (this.scanner.tokenType !== COMMA$2) {
    	                break;
    	            }

    	            this.scanner.next();
    	        }

    	        return {
    	            type: 'MediaQueryList',
    	            loc: this.getLocationFromList(children),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.eachComma(processChunk, node);
    	    }
    	};

    	// https://drafts.csswg.org/css-syntax-3/#the-anb-type
    	var Nth = {
    	    name: 'Nth',
    	    structure: {
    	        nth: ['AnPlusB', 'Identifier'],
    	        selector: ['SelectorList', null]
    	    },
    	    parse: function(allowOfClause) {
    	        this.scanner.skipSC();

    	        var start = this.scanner.tokenStart;
    	        var end = start;
    	        var selector = null;
    	        var query;

    	        if (this.scanner.lookupValue(0, 'odd') || this.scanner.lookupValue(0, 'even')) {
    	            query = this.Identifier();
    	        } else {
    	            query = this.AnPlusB();
    	        }

    	        this.scanner.skipSC();

    	        if (allowOfClause && this.scanner.lookupValue(0, 'of')) {
    	            this.scanner.next();

    	            selector = this.SelectorList();

    	            if (this.needPositions) {
    	                end = selector.children.last().loc.end.offset;
    	            }
    	        } else {
    	            if (this.needPositions) {
    	                end = query.loc.end.offset;
    	            }
    	        }

    	        return {
    	            type: 'Nth',
    	            loc: this.getLocation(start, end),
    	            nth: query,
    	            selector: selector
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.generate(processChunk, node.nth);
    	        if (node.selector !== null) {
    	            processChunk(' of ');
    	            this.generate(processChunk, node.selector);
    	        }
    	    }
    	};

    	var NUMBER$8 = tokenizer.TYPE.Number;

    	var _Number = {
    	    name: 'Number',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        return {
    	            type: 'Number',
    	            loc: this.getLocation(this.scanner.tokenStart, this.scanner.tokenEnd),
    	            value: this.scanner.consume(NUMBER$8)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	    }
    	};

    	// '/' | '*' | ',' | ':' | '+' | '-'
    	var Operator = {
    	    name: 'Operator',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        this.scanner.next();

    	        return {
    	            type: 'Operator',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: this.scanner.substrToCursor(start)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	    }
    	};

    	var TYPE$r = tokenizer.TYPE;
    	var LEFTPARENTHESIS$6 = TYPE$r.LeftParenthesis;
    	var RIGHTPARENTHESIS$4 = TYPE$r.RightParenthesis;

    	var Parentheses = {
    	    name: 'Parentheses',
    	    structure: {
    	        children: [[]]
    	    },
    	    parse: function(readSequence, recognizer) {
    	        var start = this.scanner.tokenStart;
    	        var children = null;

    	        this.scanner.eat(LEFTPARENTHESIS$6);
    	        children = readSequence.call(this, recognizer);
    	        this.scanner.eat(RIGHTPARENTHESIS$4);

    	        return {
    	            type: 'Parentheses',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('(');
    	        this.each(processChunk, node);
    	        processChunk(')');
    	    }
    	};

    	var TYPE$s = tokenizer.TYPE;

    	var NUMBER$9 = TYPE$s.Number;
    	var PERCENTSIGN$1 = TYPE$s.PercentSign;

    	var Percentage = {
    	    name: 'Percentage',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var number = this.scanner.consume(NUMBER$9);

    	        this.scanner.eat(PERCENTSIGN$1);

    	        return {
    	            type: 'Percentage',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: number
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	        processChunk('%');
    	    }
    	};

    	var TYPE$t = tokenizer.TYPE;

    	var IDENTIFIER$g = TYPE$t.Identifier;
    	var FUNCTION$4 = TYPE$t.Function;
    	var COLON$5 = TYPE$t.Colon;
    	var RIGHTPARENTHESIS$5 = TYPE$t.RightParenthesis;

    	// : ident [ '(' .. ')' ]?
    	var PseudoClassSelector = {
    	    name: 'PseudoClassSelector',
    	    structure: {
    	        name: String,
    	        children: [['Raw'], null]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var children = null;
    	        var name;
    	        var nameLowerCase;

    	        this.scanner.eat(COLON$5);

    	        if (this.scanner.tokenType === FUNCTION$4) {
    	            name = this.scanner.consumeFunctionName();
    	            nameLowerCase = name.toLowerCase();

    	            if (this.pseudo.hasOwnProperty(nameLowerCase)) {
    	                this.scanner.skipSC();
    	                children = this.pseudo[nameLowerCase].call(this);
    	                this.scanner.skipSC();
    	            } else {
    	                children = new list().appendData(
    	                    this.Raw(this.scanner.currentToken, 0, 0, false, false)
    	                );
    	            }

    	            this.scanner.eat(RIGHTPARENTHESIS$5);
    	        } else {
    	            name = this.scanner.consume(IDENTIFIER$g);
    	        }

    	        return {
    	            type: 'PseudoClassSelector',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: name,
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(':');
    	        processChunk(node.name);

    	        if (node.children !== null) {
    	            processChunk('(');
    	            this.each(processChunk, node);
    	            processChunk(')');
    	        }
    	    },
    	    walkContext: 'function'
    	};

    	var TYPE$u = tokenizer.TYPE;

    	var IDENTIFIER$h = TYPE$u.Identifier;
    	var FUNCTION$5 = TYPE$u.Function;
    	var COLON$6 = TYPE$u.Colon;
    	var RIGHTPARENTHESIS$6 = TYPE$u.RightParenthesis;

    	// :: ident [ '(' .. ')' ]?
    	var PseudoElementSelector = {
    	    name: 'PseudoElementSelector',
    	    structure: {
    	        name: String,
    	        children: [['Raw'], null]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var children = null;
    	        var name;
    	        var nameLowerCase;

    	        this.scanner.eat(COLON$6);
    	        this.scanner.eat(COLON$6);

    	        if (this.scanner.tokenType === FUNCTION$5) {
    	            name = this.scanner.consumeFunctionName();
    	            nameLowerCase = name.toLowerCase();

    	            if (this.pseudo.hasOwnProperty(nameLowerCase)) {
    	                this.scanner.skipSC();
    	                children = this.pseudo[nameLowerCase].call(this);
    	                this.scanner.skipSC();
    	            } else {
    	                children = new list().appendData(
    	                    this.Raw(this.scanner.currentToken, 0, 0, false, false)
    	                );
    	            }

    	            this.scanner.eat(RIGHTPARENTHESIS$6);
    	        } else {
    	            name = this.scanner.consume(IDENTIFIER$h);
    	        }

    	        return {
    	            type: 'PseudoElementSelector',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: name,
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('::');
    	        processChunk(node.name);

    	        if (node.children !== null) {
    	            processChunk('(');
    	            this.each(processChunk, node);
    	            processChunk(')');
    	        }
    	    },
    	    walkContext: 'function'
    	};

    	var isNumber$3 = tokenizer.isNumber;
    	var TYPE$v = tokenizer.TYPE;
    	var NUMBER$a = TYPE$v.Number;
    	var SOLIDUS$6 = TYPE$v.Solidus;
    	var FULLSTOP$4 = TYPE$v.FullStop;

    	// Terms of <ratio> should to be a positive number (not zero or negative)
    	// (see https://drafts.csswg.org/mediaqueries-3/#values)
    	// However, -o-min-device-pixel-ratio takes fractional values as a ratio's term
    	// and this is using by various sites. Therefore we relax checking on parse
    	// to test a term is unsigned number without exponent part.
    	// Additional checks may to be applied on lexer validation.
    	function consumeNumber(scanner) {
    	    var value = scanner.consumeNonWS(NUMBER$a);

    	    for (var i = 0; i < value.length; i++) {
    	        var code = value.charCodeAt(i);
    	        if (!isNumber$3(code) && code !== FULLSTOP$4) {
    	            scanner.error('Unsigned number is expected', scanner.tokenStart - value.length + i);
    	        }
    	    }

    	    if (Number(value) === 0) {
    	        scanner.error('Zero number is not allowed', scanner.tokenStart - value.length);
    	    }

    	    return value;
    	}

    	// <positive-integer> S* '/' S* <positive-integer>
    	var Ratio = {
    	    name: 'Ratio',
    	    structure: {
    	        left: String,
    	        right: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var left = consumeNumber(this.scanner);
    	        var right;

    	        this.scanner.eatNonWS(SOLIDUS$6);
    	        right = consumeNumber(this.scanner);

    	        return {
    	            type: 'Ratio',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            left: left,
    	            right: right
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.left);
    	        processChunk('/');
    	        processChunk(node.right);
    	    }
    	};

    	var Raw = {
    	    name: 'Raw',
    	    structure: {
    	        value: String
    	    },
    	    parse: function(startToken, endTokenType1, endTokenType2, includeTokenType2, excludeWhiteSpace) {
    	        var startOffset = this.scanner.getTokenStart(startToken);
    	        var endOffset;

    	        this.scanner.skip(
    	            this.scanner.getRawLength(
    	                startToken,
    	                endTokenType1,
    	                endTokenType2,
    	                includeTokenType2
    	            )
    	        );

    	        if (excludeWhiteSpace && this.scanner.tokenStart > startOffset) {
    	            endOffset = this.scanner.getOffsetExcludeWS();
    	        } else {
    	            endOffset = this.scanner.tokenStart;
    	        }

    	        return {
    	            type: 'Raw',
    	            loc: this.getLocation(startOffset, endOffset),
    	            value: this.scanner.source.substring(startOffset, endOffset)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	    }
    	};

    	var TYPE$w = tokenizer.TYPE;

    	var LEFTCURLYBRACKET$5 = TYPE$w.LeftCurlyBracket;

    	function consumeRaw$4(startToken) {
    	    return this.Raw(startToken, LEFTCURLYBRACKET$5, 0, false, true);
    	}

    	var Rule = {
    	    name: 'Rule',
    	    structure: {
    	        selector: ['SelectorList', 'Raw'],
    	        block: ['Block']
    	    },
    	    parse: function() {
    	        var startToken = this.scanner.currentToken;
    	        var startOffset = this.scanner.tokenStart;
    	        var selector = this.parseSelector
    	            ? this.tolerantParse(this.SelectorList, consumeRaw$4)
    	            : consumeRaw$4.call(this, startToken);
    	        var block = this.Block(this.Declaration);

    	        return {
    	            type: 'Rule',
    	            loc: this.getLocation(startOffset, this.scanner.tokenStart),
    	            selector: selector,
    	            block: block
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.generate(processChunk, node.selector);
    	        this.generate(processChunk, node.block);
    	    },
    	    walkContext: 'rule'
    	};

    	var Selector = {
    	    name: 'Selector',
    	    structure: {
    	        children: [[
    	            'TypeSelector',
    	            'IdSelector',
    	            'ClassSelector',
    	            'AttributeSelector',
    	            'PseudoClassSelector',
    	            'PseudoElementSelector',
    	            'Combinator',
    	            'WhiteSpace'
    	        ]]
    	    },
    	    parse: function() {
    	        var children = this.readSequence(this.scope.Selector);

    	        // nothing were consumed
    	        if (children.isEmpty()) {
    	            this.scanner.error('Selector is expected');
    	        }

    	        return {
    	            type: 'Selector',
    	            loc: this.getLocationFromList(children),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.each(processChunk, node);
    	    }
    	};

    	var TYPE$x = tokenizer.TYPE;

    	var COMMA$3 = TYPE$x.Comma;
    	var LEFTCURLYBRACKET$6 = TYPE$x.LeftCurlyBracket;

    	var SelectorList = {
    	    name: 'SelectorList',
    	    structure: {
    	        children: [['Selector', 'Raw']]
    	    },
    	    parse: function() {
    	        var children = new list();

    	        while (!this.scanner.eof) {
    	            children.appendData(this.parseSelector
    	                ? this.Selector()
    	                : this.Raw(this.scanner.currentToken, COMMA$3, LEFTCURLYBRACKET$6, false, false)
    	            );

    	            if (this.scanner.tokenType === COMMA$3) {
    	                this.scanner.next();
    	                continue;
    	            }

    	            break;
    	        }

    	        return {
    	            type: 'SelectorList',
    	            loc: this.getLocationFromList(children),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.eachComma(processChunk, node);
    	    },
    	    walkContext: 'selector'
    	};

    	var STRING$5 = tokenizer.TYPE.String;

    	var _String = {
    	    name: 'String',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        return {
    	            type: 'String',
    	            loc: this.getLocation(this.scanner.tokenStart, this.scanner.tokenEnd),
    	            value: this.scanner.consume(STRING$5)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	    }
    	};

    	var TYPE$y = tokenizer.TYPE;

    	var WHITESPACE$7 = TYPE$y.WhiteSpace;
    	var COMMENT$7 = TYPE$y.Comment;
    	var EXCLAMATIONMARK$3 = TYPE$y.ExclamationMark;
    	var ATRULE$4 = TYPE$y.Atrule;
    	var CDO$3 = TYPE$y.CDO;
    	var CDC$3 = TYPE$y.CDC;

    	function consumeRaw$5(startToken) {
    	    return this.Raw(startToken, 0, 0, false, false);
    	}

    	var StyleSheet = {
    	    name: 'StyleSheet',
    	    structure: {
    	        children: [['Comment', 'Atrule', 'Rule', 'Raw']]
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var children = new list();
    	        var child;

    	        
    	        while (!this.scanner.eof) {
    	            switch (this.scanner.tokenType) {
    	                case WHITESPACE$7:
    	                    this.scanner.next();
    	                    continue;

    	                case COMMENT$7:
    	                    // ignore comments except exclamation comments (i.e. /*! .. */) on top level
    	                    if (this.scanner.source.charCodeAt(this.scanner.tokenStart + 2) !== EXCLAMATIONMARK$3) {
    	                        this.scanner.next();
    	                        continue;
    	                    }

    	                    child = this.Comment();
    	                    break;

    	                case CDO$3: // <!--
    	                    child = this.CDO();
    	                    break;

    	                case CDC$3: // -->
    	                    child = this.CDC();
    	                    break;

    	                // CSS Syntax Module Level 3
    	                // §2.2 Error handling
    	                // At the "top level" of a stylesheet, an <at-keyword-token> starts an at-rule.
    	                case ATRULE$4:
    	                    child = this.Atrule();
    	                    break;

    	                // Anything else starts a qualified rule ...
    	                default:
    	                    child = this.tolerantParse(this.Rule, consumeRaw$5);
    	            }

    	            children.appendData(child);
    	        }

    	        return {
    	            type: 'StyleSheet',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.each(processChunk, node);
    	    },
    	    walkContext: 'stylesheet'
    	};

    	var TYPE$z = tokenizer.TYPE;

    	var IDENTIFIER$i = TYPE$z.Identifier;
    	var ASTERISK$5 = TYPE$z.Asterisk;
    	var VERTICALLINE$2 = TYPE$z.VerticalLine;

    	function eatIdentifierOrAsterisk() {
    	    if (this.scanner.tokenType !== IDENTIFIER$i &&
    	        this.scanner.tokenType !== ASTERISK$5) {
    	        this.scanner.error('Identifier or asterisk is expected');
    	    }

    	    this.scanner.next();
    	}

    	// ident
    	// ident|ident
    	// ident|*
    	// *
    	// *|ident
    	// *|*
    	// |ident
    	// |*
    	var TypeSelector = {
    	    name: 'TypeSelector',
    	    structure: {
    	        name: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        if (this.scanner.tokenType === VERTICALLINE$2) {
    	            this.scanner.next();
    	            eatIdentifierOrAsterisk.call(this);
    	        } else {
    	            eatIdentifierOrAsterisk.call(this);

    	            if (this.scanner.tokenType === VERTICALLINE$2) {
    	                this.scanner.next();
    	                eatIdentifierOrAsterisk.call(this);
    	            }
    	        }

    	        return {
    	            type: 'TypeSelector',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            name: this.scanner.substrToCursor(start)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.name);
    	    }
    	};

    	var isHex$2 = tokenizer.isHex;
    	var TYPE$A = tokenizer.TYPE;

    	var IDENTIFIER$j = TYPE$A.Identifier;
    	var NUMBER$b = TYPE$A.Number;
    	var PLUSSIGN$7 = TYPE$A.PlusSign;
    	var HYPHENMINUS$7 = TYPE$A.HyphenMinus;
    	var FULLSTOP$5 = TYPE$A.FullStop;
    	var QUESTIONMARK = TYPE$A.QuestionMark;

    	function scanUnicodeNumber(scanner) {
    	    for (var pos = scanner.tokenStart + 1; pos < scanner.tokenEnd; pos++) {
    	        var code = scanner.source.charCodeAt(pos);

    	        // break on fullstop or hyperminus/plussign after exponent
    	        if (code === FULLSTOP$5 || code === PLUSSIGN$7) {
    	            // break token, exclude symbol
    	            scanner.tokenStart = pos;
    	            return false;
    	        }
    	    }

    	    return true;
    	}

    	// https://drafts.csswg.org/css-syntax-3/#urange
    	function scanUnicodeRange(scanner) {
    	    var hexStart = scanner.tokenStart + 1; // skip +
    	    var hexLength = 0;

    	    scan: {
    	        if (scanner.tokenType === NUMBER$b) {
    	            if (scanner.source.charCodeAt(scanner.tokenStart) !== FULLSTOP$5 && scanUnicodeNumber(scanner)) {
    	                scanner.next();
    	            } else if (scanner.source.charCodeAt(scanner.tokenStart) !== HYPHENMINUS$7) {
    	                break scan;
    	            }
    	        } else {
    	            scanner.next(); // PLUSSIGN
    	        }

    	        if (scanner.tokenType === HYPHENMINUS$7) {
    	            scanner.next();
    	        }

    	        if (scanner.tokenType === NUMBER$b) {
    	            scanner.next();
    	        }

    	        if (scanner.tokenType === IDENTIFIER$j) {
    	            scanner.next();
    	        }

    	        if (scanner.tokenStart === hexStart) {
    	            scanner.error('Unexpected input', hexStart);
    	        }
    	    }

    	    // validate for U+x{1,6} or U+x{1,6}-x{1,6}
    	    // where x is [0-9a-fA-F]
    	    for (var i = hexStart, wasHyphenMinus = false; i < scanner.tokenStart; i++) {
    	        var code = scanner.source.charCodeAt(i);

    	        if (isHex$2(code) === false && (code !== HYPHENMINUS$7 || wasHyphenMinus)) {
    	            scanner.error('Unexpected input', i);
    	        }

    	        if (code === HYPHENMINUS$7) {
    	            // hex sequence shouldn't be an empty
    	            if (hexLength === 0) {
    	                scanner.error('Unexpected input', i);
    	            }

    	            wasHyphenMinus = true;
    	            hexLength = 0;
    	        } else {
    	            hexLength++;

    	            // too long hex sequence
    	            if (hexLength > 6) {
    	                scanner.error('Too long hex sequence', i);
    	            }
    	        }

    	    }

    	    // check we have a non-zero sequence
    	    if (hexLength === 0) {
    	        scanner.error('Unexpected input', i - 1);
    	    }

    	    // U+abc???
    	    if (!wasHyphenMinus) {
    	        // consume as many U+003F QUESTION MARK (?) code points as possible
    	        for (; hexLength < 6 && !scanner.eof; scanner.next()) {
    	            if (scanner.tokenType !== QUESTIONMARK) {
    	                break;
    	            }

    	            hexLength++;
    	        }
    	    }
    	}

    	var UnicodeRange = {
    	    name: 'UnicodeRange',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;

    	        this.scanner.next(); // U or u
    	        scanUnicodeRange(this.scanner);

    	        return {
    	            type: 'UnicodeRange',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: this.scanner.substrToCursor(start)
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	    }
    	};

    	var TYPE$B = tokenizer.TYPE;

    	var STRING$6 = TYPE$B.String;
    	var URL$4 = TYPE$B.Url;
    	var RAW$2 = TYPE$B.Raw;
    	var RIGHTPARENTHESIS$7 = TYPE$B.RightParenthesis;

    	// url '(' S* (string | raw) S* ')'
    	var Url = {
    	    name: 'Url',
    	    structure: {
    	        value: ['String', 'Raw']
    	    },
    	    parse: function() {
    	        var start = this.scanner.tokenStart;
    	        var value;

    	        this.scanner.eat(URL$4);
    	        this.scanner.skipSC();

    	        switch (this.scanner.tokenType) {
    	            case STRING$6:
    	                value = this.String();
    	                break;

    	            case RAW$2:
    	                value = this.Raw(this.scanner.currentToken, 0, RAW$2, true, false);
    	                break;

    	            default:
    	                this.scanner.error('String or Raw is expected');
    	        }

    	        this.scanner.skipSC();
    	        this.scanner.eat(RIGHTPARENTHESIS$7);

    	        return {
    	            type: 'Url',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            value: value
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk('url');
    	        processChunk('(');
    	        this.generate(processChunk, node.value);
    	        processChunk(')');
    	    }
    	};

    	var endsWith$1 = tokenizer.endsWith;
    	var TYPE$C = tokenizer.TYPE;

    	var WHITESPACE$8 = TYPE$C.WhiteSpace;
    	var COMMENT$8 = TYPE$C.Comment;
    	var FUNCTION$6 = TYPE$C.Function;
    	var COLON$7 = TYPE$C.Colon;
    	var SEMICOLON$6 = TYPE$C.Semicolon;
    	var EXCLAMATIONMARK$4 = TYPE$C.ExclamationMark;

    	// 'progid:' ws* 'DXImageTransform.Microsoft.' ident ws* '(' .* ')'
    	function checkProgid(scanner) {
    	    var offset = 0;

    	    for (var type; type = scanner.lookupType(offset); offset++) {
    	        if (type !== WHITESPACE$8 && type !== COMMENT$8) {
    	            break;
    	        }
    	    }

    	    if (scanner.lookupValue(offset, 'alpha(') ||
    	        scanner.lookupValue(offset, 'chroma(') ||
    	        scanner.lookupValue(offset, 'dropshadow(')) {
    	        if (scanner.lookupType(offset) !== FUNCTION$6) {
    	            return false;
    	        }
    	    } else {
    	        if (scanner.lookupValue(offset, 'progid') === false ||
    	            scanner.lookupType(offset + 1) !== COLON$7) {
    	            return false;
    	        }
    	    }

    	    return true;
    	}

    	var Value = {
    	    name: 'Value',
    	    structure: {
    	        children: [[]]
    	    },
    	    parse: function(property) {
    	        // special parser for filter property since it can contains non-standart syntax for old IE
    	        if (property !== null && endsWith$1(property, 'filter') && checkProgid(this.scanner)) {
    	            this.scanner.skipSC();
    	            return this.Raw(this.scanner.currentToken, EXCLAMATIONMARK$4, SEMICOLON$6, false, false);
    	        }

    	        var start = this.scanner.tokenStart;
    	        var children = this.readSequence(this.scope.Value);

    	        return {
    	            type: 'Value',
    	            loc: this.getLocation(start, this.scanner.tokenStart),
    	            children: children
    	        };
    	    },
    	    generate: function(processChunk, node) {
    	        this.each(processChunk, node);
    	    }
    	};

    	var WHITESPACE$9 = tokenizer.TYPE.WhiteSpace;
    	var SPACE$2 = Object.freeze({
    	    type: 'WhiteSpace',
    	    loc: null,
    	    value: ' '
    	});

    	var WhiteSpace = {
    	    name: 'WhiteSpace',
    	    structure: {
    	        value: String
    	    },
    	    parse: function() {
    	        this.scanner.eat(WHITESPACE$9);
    	        return SPACE$2;

    	        // return {
    	        //     type: 'WhiteSpace',
    	        //     loc: this.getLocation(this.scanner.tokenStart, this.scanner.tokenEnd),
    	        //     value: this.scanner.consume(WHITESPACE)
    	        // };
    	    },
    	    generate: function(processChunk, node) {
    	        processChunk(node.value);
    	    }
    	};

    	var node = {
    	    AnPlusB: AnPlusB,
    	    Atrule: Atrule,
    	    AtruleExpression: AtruleExpression,
    	    AttributeSelector: AttributeSelector,
    	    Block: Block,
    	    Brackets: Brackets,
    	    CDC: CDC_1,
    	    CDO: CDO_1,
    	    ClassSelector: ClassSelector,
    	    Combinator: Combinator,
    	    Comment: Comment,
    	    Declaration: Declaration,
    	    DeclarationList: DeclarationList,
    	    Dimension: Dimension,
    	    Function: _Function,
    	    HexColor: HexColor,
    	    Identifier: Identifier,
    	    IdSelector: IdSelector,
    	    MediaFeature: MediaFeature,
    	    MediaQuery: MediaQuery,
    	    MediaQueryList: MediaQueryList,
    	    Nth: Nth,
    	    Number: _Number,
    	    Operator: Operator,
    	    Parentheses: Parentheses,
    	    Percentage: Percentage,
    	    PseudoClassSelector: PseudoClassSelector,
    	    PseudoElementSelector: PseudoElementSelector,
    	    Ratio: Ratio,
    	    Raw: Raw,
    	    Rule: Rule,
    	    Selector: Selector,
    	    SelectorList: SelectorList,
    	    String: _String,
    	    StyleSheet: StyleSheet,
    	    TypeSelector: TypeSelector,
    	    UnicodeRange: UnicodeRange,
    	    Url: Url,
    	    Value: Value,
    	    WhiteSpace: WhiteSpace
    	};

    	var parser = {
    	    parseContext: {
    	        default: 'StyleSheet',
    	        stylesheet: 'StyleSheet',
    	        atrule: 'Atrule',
    	        atruleExpression: function(options) {
    	            return this.AtruleExpression(options.atrule ? String(options.atrule) : null);
    	        },
    	        mediaQueryList: 'MediaQueryList',
    	        mediaQuery: 'MediaQuery',
    	        rule: 'Rule',
    	        selectorList: 'SelectorList',
    	        selector: 'Selector',
    	        block: function() {
    	            return this.Block(this.Declaration);
    	        },
    	        declarationList: 'DeclarationList',
    	        declaration: 'Declaration',
    	        value: function(options) {
    	            return this.Value(options.property ? String(options.property) : null);
    	        }
    	    },
    	    scope: scope,
    	    atrule: atrule,
    	    pseudo: pseudo,
    	    node: node
    	};

    	var parser$1 = create(parser);

    	function walk(ast, { enter, leave }) {
    		return visit(ast, null, enter, leave);
    	}

    	let should_skip = false;
    	let should_remove = false;
    	let replacement = null;
    	const context = {
    		skip: () => should_skip = true,
    		remove: () => should_remove = true,
    		replace: (node) => replacement = node
    	};

    	function replace(parent, prop, index, node) {
    		if (parent) {
    			if (index !== null) {
    				parent[prop][index] = node;
    			} else {
    				parent[prop] = node;
    			}
    		}
    	}

    	function remove(parent, prop, index) {
    		if (parent) {
    			if (index !== null) {
    				parent[prop].splice(index, 1);
    			} else {
    				delete parent[prop];
    			}
    		}
    	}

    	function visit(
    		node,
    		parent,
    		enter,
    		leave,
    		prop,
    		index
    	) {
    		if (node) {
    			if (enter) {
    				const _should_skip = should_skip;
    				const _should_remove = should_remove;
    				const _replacement = replacement;
    				should_skip = false;
    				should_remove = false;
    				replacement = null;

    				enter.call(context, node, parent, prop, index);

    				if (replacement) {
    					node = replacement;
    					replace(parent, prop, index, node);
    				}

    				if (should_remove) {
    					remove(parent, prop, index);
    				}

    				const skipped = should_skip;
    				const removed = should_remove;

    				should_skip = _should_skip;
    				should_remove = _should_remove;
    				replacement = _replacement;

    				if (skipped) return node;
    				if (removed) return null;
    			}

    			for (const key in node) {
    				const value = (node )[key];

    				if (typeof value !== 'object') {
    					continue;
    				}

    				else if (Array.isArray(value)) {
    					for (let j = 0, k = 0; j < value.length; j += 1, k += 1) {
    						if (value[j] !== null && typeof value[j].type === 'string') {
    							if (!visit(value[j], node, enter, leave, key, k)) {
    								// removed
    								j--;
    							}
    						}
    					}
    				}

    				else if (value !== null && typeof value.type === 'string') {
    					visit(value, node, enter, leave, key, null);
    				}
    			}

    			if (leave) {
    				const _replacement = replacement;
    				const _should_remove = should_remove;
    				replacement = null;
    				should_remove = false;

    				leave.call(context, node, parent, prop, index);

    				if (replacement) {
    					node = replacement;
    					replace(parent, prop, index, node);
    				}

    				if (should_remove) {
    					remove(parent, prop, index);
    				}

    				const removed = should_remove;

    				replacement = _replacement;
    				should_remove = _should_remove;

    				if (removed) return null;
    			}
    		}

    		return node;
    	}

    	function read_style(parser, start, attributes) {
    	    const content_start = parser.index;
    	    const styles = parser.read_until(/<\/style>/);
    	    const content_end = parser.index;
    	    let ast;
    	    try {
    	        ast = parser$1(styles, {
    	            positions: true,
    	            offset: content_start,
    	        });
    	    }
    	    catch (err) {
    	        if (err.name === 'CssSyntaxError') {
    	            parser.error({
    	                code: `css-syntax-error`,
    	                message: err.message
    	            }, err.offset);
    	        }
    	        else {
    	            throw err;
    	        }
    	    }
    	    ast = JSON.parse(JSON.stringify(ast));
    	    // tidy up AST
    	    walk(ast, {
    	        enter: (node) => {
    	            // replace `ref:a` nodes
    	            if (node.type === 'Selector') {
    	                for (let i = 0; i < node.children.length; i += 1) {
    	                    const a = node.children[i];
    	                    const b = node.children[i + 1];
    	                    if (is_ref_selector(a, b)) {
    	                        parser.error({
    	                            code: `invalid-ref-selector`,
    	                            message: 'ref selectors are no longer supported'
    	                        }, a.loc.start.offset);
    	                    }
    	                }
    	            }
    	            if (node.type === 'Declaration' && node.value.type === 'Value' && node.value.children.length === 0) {
    	                parser.error({
    	                    code: `invalid-declaration`,
    	                    message: `Declaration cannot be empty`
    	                }, node.start);
    	            }
    	            if (node.loc) {
    	                node.start = node.loc.start.offset;
    	                node.end = node.loc.end.offset;
    	                delete node.loc;
    	            }
    	        }
    	    });
    	    parser.eat('</style>', true);
    	    const end = parser.index;
    	    return {
    	        type: 'Style',
    	        start,
    	        end,
    	        attributes,
    	        children: ast.children,
    	        content: {
    	            start: content_start,
    	            end: content_end,
    	            styles
    	        }
    	    };
    	}
    	function is_ref_selector(a, b) {
    	    if (!b)
    	        return false;
    	    return (a.type === 'TypeSelector' &&
    	        a.name === 'ref' &&
    	        b.type === 'PseudoClassSelector');
    	}

    	// https://dev.w3.org/html5/html-author/charref
    	var entities = {
    	    CounterClockwiseContourIntegral: 8755,
    	    ClockwiseContourIntegral: 8754,
    	    DoubleLongLeftRightArrow: 10234,
    	    DiacriticalDoubleAcute: 733,
    	    NotSquareSupersetEqual: 8931,
    	    CloseCurlyDoubleQuote: 8221,
    	    DoubleContourIntegral: 8751,
    	    FilledVerySmallSquare: 9642,
    	    NegativeVeryThinSpace: 8203,
    	    NotPrecedesSlantEqual: 8928,
    	    NotRightTriangleEqual: 8941,
    	    NotSucceedsSlantEqual: 8929,
    	    CapitalDifferentialD: 8517,
    	    DoubleLeftRightArrow: 8660,
    	    DoubleLongRightArrow: 10233,
    	    EmptyVerySmallSquare: 9643,
    	    NestedGreaterGreater: 8811,
    	    NotDoubleVerticalBar: 8742,
    	    NotLeftTriangleEqual: 8940,
    	    NotSquareSubsetEqual: 8930,
    	    OpenCurlyDoubleQuote: 8220,
    	    ReverseUpEquilibrium: 10607,
    	    DoubleLongLeftArrow: 10232,
    	    DownLeftRightVector: 10576,
    	    LeftArrowRightArrow: 8646,
    	    NegativeMediumSpace: 8203,
    	    RightArrowLeftArrow: 8644,
    	    SquareSupersetEqual: 8850,
    	    leftrightsquigarrow: 8621,
    	    DownRightTeeVector: 10591,
    	    DownRightVectorBar: 10583,
    	    LongLeftRightArrow: 10231,
    	    Longleftrightarrow: 10234,
    	    NegativeThickSpace: 8203,
    	    PrecedesSlantEqual: 8828,
    	    ReverseEquilibrium: 8651,
    	    RightDoubleBracket: 10215,
    	    RightDownTeeVector: 10589,
    	    RightDownVectorBar: 10581,
    	    RightTriangleEqual: 8885,
    	    SquareIntersection: 8851,
    	    SucceedsSlantEqual: 8829,
    	    blacktriangleright: 9656,
    	    longleftrightarrow: 10231,
    	    DoubleUpDownArrow: 8661,
    	    DoubleVerticalBar: 8741,
    	    DownLeftTeeVector: 10590,
    	    DownLeftVectorBar: 10582,
    	    FilledSmallSquare: 9724,
    	    GreaterSlantEqual: 10878,
    	    LeftDoubleBracket: 10214,
    	    LeftDownTeeVector: 10593,
    	    LeftDownVectorBar: 10585,
    	    LeftTriangleEqual: 8884,
    	    NegativeThinSpace: 8203,
    	    NotReverseElement: 8716,
    	    NotTildeFullEqual: 8775,
    	    RightAngleBracket: 10217,
    	    RightUpDownVector: 10575,
    	    SquareSubsetEqual: 8849,
    	    VerticalSeparator: 10072,
    	    blacktriangledown: 9662,
    	    blacktriangleleft: 9666,
    	    leftrightharpoons: 8651,
    	    rightleftharpoons: 8652,
    	    twoheadrightarrow: 8608,
    	    DiacriticalAcute: 180,
    	    DiacriticalGrave: 96,
    	    DiacriticalTilde: 732,
    	    DoubleRightArrow: 8658,
    	    DownArrowUpArrow: 8693,
    	    EmptySmallSquare: 9723,
    	    GreaterEqualLess: 8923,
    	    GreaterFullEqual: 8807,
    	    LeftAngleBracket: 10216,
    	    LeftUpDownVector: 10577,
    	    LessEqualGreater: 8922,
    	    NonBreakingSpace: 160,
    	    NotRightTriangle: 8939,
    	    NotSupersetEqual: 8841,
    	    RightTriangleBar: 10704,
    	    RightUpTeeVector: 10588,
    	    RightUpVectorBar: 10580,
    	    UnderParenthesis: 9181,
    	    UpArrowDownArrow: 8645,
    	    circlearrowright: 8635,
    	    downharpoonright: 8642,
    	    ntrianglerighteq: 8941,
    	    rightharpoondown: 8641,
    	    rightrightarrows: 8649,
    	    twoheadleftarrow: 8606,
    	    vartriangleright: 8883,
    	    CloseCurlyQuote: 8217,
    	    ContourIntegral: 8750,
    	    DoubleDownArrow: 8659,
    	    DoubleLeftArrow: 8656,
    	    DownRightVector: 8641,
    	    LeftRightVector: 10574,
    	    LeftTriangleBar: 10703,
    	    LeftUpTeeVector: 10592,
    	    LeftUpVectorBar: 10584,
    	    LowerRightArrow: 8600,
    	    NotGreaterEqual: 8817,
    	    NotGreaterTilde: 8821,
    	    NotLeftTriangle: 8938,
    	    OverParenthesis: 9180,
    	    RightDownVector: 8642,
    	    ShortRightArrow: 8594,
    	    UpperRightArrow: 8599,
    	    bigtriangledown: 9661,
    	    circlearrowleft: 8634,
    	    curvearrowright: 8631,
    	    downharpoonleft: 8643,
    	    leftharpoondown: 8637,
    	    leftrightarrows: 8646,
    	    nLeftrightarrow: 8654,
    	    nleftrightarrow: 8622,
    	    ntrianglelefteq: 8940,
    	    rightleftarrows: 8644,
    	    rightsquigarrow: 8605,
    	    rightthreetimes: 8908,
    	    straightepsilon: 1013,
    	    trianglerighteq: 8885,
    	    vartriangleleft: 8882,
    	    DiacriticalDot: 729,
    	    DoubleRightTee: 8872,
    	    DownLeftVector: 8637,
    	    GreaterGreater: 10914,
    	    HorizontalLine: 9472,
    	    InvisibleComma: 8291,
    	    InvisibleTimes: 8290,
    	    LeftDownVector: 8643,
    	    LeftRightArrow: 8596,
    	    Leftrightarrow: 8660,
    	    LessSlantEqual: 10877,
    	    LongRightArrow: 10230,
    	    Longrightarrow: 10233,
    	    LowerLeftArrow: 8601,
    	    NestedLessLess: 8810,
    	    NotGreaterLess: 8825,
    	    NotLessGreater: 8824,
    	    NotSubsetEqual: 8840,
    	    NotVerticalBar: 8740,
    	    OpenCurlyQuote: 8216,
    	    ReverseElement: 8715,
    	    RightTeeVector: 10587,
    	    RightVectorBar: 10579,
    	    ShortDownArrow: 8595,
    	    ShortLeftArrow: 8592,
    	    SquareSuperset: 8848,
    	    TildeFullEqual: 8773,
    	    UpperLeftArrow: 8598,
    	    ZeroWidthSpace: 8203,
    	    curvearrowleft: 8630,
    	    doublebarwedge: 8966,
    	    downdownarrows: 8650,
    	    hookrightarrow: 8618,
    	    leftleftarrows: 8647,
    	    leftrightarrow: 8596,
    	    leftthreetimes: 8907,
    	    longrightarrow: 10230,
    	    looparrowright: 8620,
    	    nshortparallel: 8742,
    	    ntriangleright: 8939,
    	    rightarrowtail: 8611,
    	    rightharpoonup: 8640,
    	    trianglelefteq: 8884,
    	    upharpoonright: 8638,
    	    ApplyFunction: 8289,
    	    DifferentialD: 8518,
    	    DoubleLeftTee: 10980,
    	    DoubleUpArrow: 8657,
    	    LeftTeeVector: 10586,
    	    LeftVectorBar: 10578,
    	    LessFullEqual: 8806,
    	    LongLeftArrow: 10229,
    	    Longleftarrow: 10232,
    	    NotTildeEqual: 8772,
    	    NotTildeTilde: 8777,
    	    Poincareplane: 8460,
    	    PrecedesEqual: 10927,
    	    PrecedesTilde: 8830,
    	    RightArrowBar: 8677,
    	    RightTeeArrow: 8614,
    	    RightTriangle: 8883,
    	    RightUpVector: 8638,
    	    SucceedsEqual: 10928,
    	    SucceedsTilde: 8831,
    	    SupersetEqual: 8839,
    	    UpEquilibrium: 10606,
    	    VerticalTilde: 8768,
    	    VeryThinSpace: 8202,
    	    bigtriangleup: 9651,
    	    blacktriangle: 9652,
    	    divideontimes: 8903,
    	    fallingdotseq: 8786,
    	    hookleftarrow: 8617,
    	    leftarrowtail: 8610,
    	    leftharpoonup: 8636,
    	    longleftarrow: 10229,
    	    looparrowleft: 8619,
    	    measuredangle: 8737,
    	    ntriangleleft: 8938,
    	    shortparallel: 8741,
    	    smallsetminus: 8726,
    	    triangleright: 9657,
    	    upharpoonleft: 8639,
    	    DownArrowBar: 10515,
    	    DownTeeArrow: 8615,
    	    ExponentialE: 8519,
    	    GreaterEqual: 8805,
    	    GreaterTilde: 8819,
    	    HilbertSpace: 8459,
    	    HumpDownHump: 8782,
    	    Intersection: 8898,
    	    LeftArrowBar: 8676,
    	    LeftTeeArrow: 8612,
    	    LeftTriangle: 8882,
    	    LeftUpVector: 8639,
    	    NotCongruent: 8802,
    	    NotLessEqual: 8816,
    	    NotLessTilde: 8820,
    	    Proportional: 8733,
    	    RightCeiling: 8969,
    	    RoundImplies: 10608,
    	    ShortUpArrow: 8593,
    	    SquareSubset: 8847,
    	    UnderBracket: 9141,
    	    VerticalLine: 124,
    	    blacklozenge: 10731,
    	    exponentiale: 8519,
    	    risingdotseq: 8787,
    	    triangledown: 9663,
    	    triangleleft: 9667,
    	    CircleMinus: 8854,
    	    CircleTimes: 8855,
    	    Equilibrium: 8652,
    	    GreaterLess: 8823,
    	    LeftCeiling: 8968,
    	    LessGreater: 8822,
    	    MediumSpace: 8287,
    	    NotPrecedes: 8832,
    	    NotSucceeds: 8833,
    	    OverBracket: 9140,
    	    RightVector: 8640,
    	    Rrightarrow: 8667,
    	    RuleDelayed: 10740,
    	    SmallCircle: 8728,
    	    SquareUnion: 8852,
    	    SubsetEqual: 8838,
    	    UpDownArrow: 8597,
    	    Updownarrow: 8661,
    	    VerticalBar: 8739,
    	    backepsilon: 1014,
    	    blacksquare: 9642,
    	    circledcirc: 8858,
    	    circleddash: 8861,
    	    curlyeqprec: 8926,
    	    curlyeqsucc: 8927,
    	    diamondsuit: 9830,
    	    eqslantless: 10901,
    	    expectation: 8496,
    	    nRightarrow: 8655,
    	    nrightarrow: 8603,
    	    preccurlyeq: 8828,
    	    precnapprox: 10937,
    	    quaternions: 8461,
    	    straightphi: 981,
    	    succcurlyeq: 8829,
    	    succnapprox: 10938,
    	    thickapprox: 8776,
    	    updownarrow: 8597,
    	    Bernoullis: 8492,
    	    CirclePlus: 8853,
    	    EqualTilde: 8770,
    	    Fouriertrf: 8497,
    	    ImaginaryI: 8520,
    	    Laplacetrf: 8466,
    	    LeftVector: 8636,
    	    Lleftarrow: 8666,
    	    NotElement: 8713,
    	    NotGreater: 8815,
    	    Proportion: 8759,
    	    RightArrow: 8594,
    	    RightFloor: 8971,
    	    Rightarrow: 8658,
    	    TildeEqual: 8771,
    	    TildeTilde: 8776,
    	    UnderBrace: 9183,
    	    UpArrowBar: 10514,
    	    UpTeeArrow: 8613,
    	    circledast: 8859,
    	    complement: 8705,
    	    curlywedge: 8911,
    	    eqslantgtr: 10902,
    	    gtreqqless: 10892,
    	    lessapprox: 10885,
    	    lesseqqgtr: 10891,
    	    lmoustache: 9136,
    	    longmapsto: 10236,
    	    mapstodown: 8615,
    	    mapstoleft: 8612,
    	    nLeftarrow: 8653,
    	    nleftarrow: 8602,
    	    precapprox: 10935,
    	    rightarrow: 8594,
    	    rmoustache: 9137,
    	    sqsubseteq: 8849,
    	    sqsupseteq: 8850,
    	    subsetneqq: 10955,
    	    succapprox: 10936,
    	    supsetneqq: 10956,
    	    upuparrows: 8648,
    	    varepsilon: 949,
    	    varnothing: 8709,
    	    Backslash: 8726,
    	    CenterDot: 183,
    	    CircleDot: 8857,
    	    Congruent: 8801,
    	    Coproduct: 8720,
    	    DoubleDot: 168,
    	    DownArrow: 8595,
    	    DownBreve: 785,
    	    Downarrow: 8659,
    	    HumpEqual: 8783,
    	    LeftArrow: 8592,
    	    LeftFloor: 8970,
    	    Leftarrow: 8656,
    	    LessTilde: 8818,
    	    Mellintrf: 8499,
    	    MinusPlus: 8723,
    	    NotCupCap: 8813,
    	    NotExists: 8708,
    	    OverBrace: 9182,
    	    PlusMinus: 177,
    	    Therefore: 8756,
    	    ThinSpace: 8201,
    	    TripleDot: 8411,
    	    UnionPlus: 8846,
    	    backprime: 8245,
    	    backsimeq: 8909,
    	    bigotimes: 10754,
    	    centerdot: 183,
    	    checkmark: 10003,
    	    complexes: 8450,
    	    dotsquare: 8865,
    	    downarrow: 8595,
    	    gtrapprox: 10886,
    	    gtreqless: 8923,
    	    heartsuit: 9829,
    	    leftarrow: 8592,
    	    lesseqgtr: 8922,
    	    nparallel: 8742,
    	    nshortmid: 8740,
    	    nsubseteq: 8840,
    	    nsupseteq: 8841,
    	    pitchfork: 8916,
    	    rationals: 8474,
    	    spadesuit: 9824,
    	    subseteqq: 10949,
    	    subsetneq: 8842,
    	    supseteqq: 10950,
    	    supsetneq: 8843,
    	    therefore: 8756,
    	    triangleq: 8796,
    	    varpropto: 8733,
    	    DDotrahd: 10513,
    	    DotEqual: 8784,
    	    Integral: 8747,
    	    LessLess: 10913,
    	    NotEqual: 8800,
    	    NotTilde: 8769,
    	    PartialD: 8706,
    	    Precedes: 8826,
    	    RightTee: 8866,
    	    Succeeds: 8827,
    	    SuchThat: 8715,
    	    Superset: 8835,
    	    Uarrocir: 10569,
    	    UnderBar: 818,
    	    andslope: 10840,
    	    angmsdaa: 10664,
    	    angmsdab: 10665,
    	    angmsdac: 10666,
    	    angmsdad: 10667,
    	    angmsdae: 10668,
    	    angmsdaf: 10669,
    	    angmsdag: 10670,
    	    angmsdah: 10671,
    	    angrtvbd: 10653,
    	    approxeq: 8778,
    	    awconint: 8755,
    	    backcong: 8780,
    	    barwedge: 8965,
    	    bbrktbrk: 9142,
    	    bigoplus: 10753,
    	    bigsqcup: 10758,
    	    biguplus: 10756,
    	    bigwedge: 8896,
    	    boxminus: 8863,
    	    boxtimes: 8864,
    	    capbrcup: 10825,
    	    circledR: 174,
    	    circledS: 9416,
    	    cirfnint: 10768,
    	    clubsuit: 9827,
    	    cupbrcap: 10824,
    	    curlyvee: 8910,
    	    cwconint: 8754,
    	    doteqdot: 8785,
    	    dotminus: 8760,
    	    drbkarow: 10512,
    	    dzigrarr: 10239,
    	    elinters: 9191,
    	    emptyset: 8709,
    	    eqvparsl: 10725,
    	    fpartint: 10765,
    	    geqslant: 10878,
    	    gesdotol: 10884,
    	    gnapprox: 10890,
    	    hksearow: 10533,
    	    hkswarow: 10534,
    	    imagline: 8464,
    	    imagpart: 8465,
    	    infintie: 10717,
    	    integers: 8484,
    	    intercal: 8890,
    	    intlarhk: 10775,
    	    laemptyv: 10676,
    	    ldrushar: 10571,
    	    leqslant: 10877,
    	    lesdotor: 10883,
    	    llcorner: 8990,
    	    lnapprox: 10889,
    	    lrcorner: 8991,
    	    lurdshar: 10570,
    	    mapstoup: 8613,
    	    multimap: 8888,
    	    naturals: 8469,
    	    otimesas: 10806,
    	    parallel: 8741,
    	    plusacir: 10787,
    	    pointint: 10773,
    	    precneqq: 10933,
    	    precnsim: 8936,
    	    profalar: 9006,
    	    profline: 8978,
    	    profsurf: 8979,
    	    raemptyv: 10675,
    	    realpart: 8476,
    	    rppolint: 10770,
    	    rtriltri: 10702,
    	    scpolint: 10771,
    	    setminus: 8726,
    	    shortmid: 8739,
    	    smeparsl: 10724,
    	    sqsubset: 8847,
    	    sqsupset: 8848,
    	    subseteq: 8838,
    	    succneqq: 10934,
    	    succnsim: 8937,
    	    supseteq: 8839,
    	    thetasym: 977,
    	    thicksim: 8764,
    	    timesbar: 10801,
    	    triangle: 9653,
    	    triminus: 10810,
    	    trpezium: 9186,
    	    ulcorner: 8988,
    	    urcorner: 8989,
    	    varkappa: 1008,
    	    varsigma: 962,
    	    vartheta: 977,
    	    Because: 8757,
    	    Cayleys: 8493,
    	    Cconint: 8752,
    	    Cedilla: 184,
    	    Diamond: 8900,
    	    DownTee: 8868,
    	    Element: 8712,
    	    Epsilon: 917,
    	    Implies: 8658,
    	    LeftTee: 8867,
    	    NewLine: 10,
    	    NoBreak: 8288,
    	    NotLess: 8814,
    	    Omicron: 927,
    	    OverBar: 175,
    	    Product: 8719,
    	    UpArrow: 8593,
    	    Uparrow: 8657,
    	    Upsilon: 933,
    	    alefsym: 8501,
    	    angrtvb: 8894,
    	    angzarr: 9084,
    	    asympeq: 8781,
    	    backsim: 8765,
    	    because: 8757,
    	    bemptyv: 10672,
    	    between: 8812,
    	    bigcirc: 9711,
    	    bigodot: 10752,
    	    bigstar: 9733,
    	    boxplus: 8862,
    	    ccupssm: 10832,
    	    cemptyv: 10674,
    	    cirscir: 10690,
    	    coloneq: 8788,
    	    congdot: 10861,
    	    cudarrl: 10552,
    	    cudarrr: 10549,
    	    cularrp: 10557,
    	    curarrm: 10556,
    	    dbkarow: 10511,
    	    ddagger: 8225,
    	    ddotseq: 10871,
    	    demptyv: 10673,
    	    diamond: 8900,
    	    digamma: 989,
    	    dotplus: 8724,
    	    dwangle: 10662,
    	    epsilon: 949,
    	    eqcolon: 8789,
    	    equivDD: 10872,
    	    gesdoto: 10882,
    	    gtquest: 10876,
    	    gtrless: 8823,
    	    harrcir: 10568,
    	    intprod: 10812,
    	    isindot: 8949,
    	    larrbfs: 10527,
    	    larrsim: 10611,
    	    lbrksld: 10639,
    	    lbrkslu: 10637,
    	    ldrdhar: 10599,
    	    lesdoto: 10881,
    	    lessdot: 8918,
    	    lessgtr: 8822,
    	    lesssim: 8818,
    	    lotimes: 10804,
    	    lozenge: 9674,
    	    ltquest: 10875,
    	    luruhar: 10598,
    	    maltese: 10016,
    	    minusdu: 10794,
    	    napprox: 8777,
    	    natural: 9838,
    	    nearrow: 8599,
    	    nexists: 8708,
    	    notinva: 8713,
    	    notinvb: 8951,
    	    notinvc: 8950,
    	    notniva: 8716,
    	    notnivb: 8958,
    	    notnivc: 8957,
    	    npolint: 10772,
    	    nsqsube: 8930,
    	    nsqsupe: 8931,
    	    nvinfin: 10718,
    	    nwarrow: 8598,
    	    olcross: 10683,
    	    omicron: 959,
    	    orderof: 8500,
    	    orslope: 10839,
    	    pertenk: 8241,
    	    planckh: 8462,
    	    pluscir: 10786,
    	    plussim: 10790,
    	    plustwo: 10791,
    	    precsim: 8830,
    	    quatint: 10774,
    	    questeq: 8799,
    	    rarrbfs: 10528,
    	    rarrsim: 10612,
    	    rbrksld: 10638,
    	    rbrkslu: 10640,
    	    rdldhar: 10601,
    	    realine: 8475,
    	    rotimes: 10805,
    	    ruluhar: 10600,
    	    searrow: 8600,
    	    simplus: 10788,
    	    simrarr: 10610,
    	    subedot: 10947,
    	    submult: 10945,
    	    subplus: 10943,
    	    subrarr: 10617,
    	    succsim: 8831,
    	    supdsub: 10968,
    	    supedot: 10948,
    	    suphsub: 10967,
    	    suplarr: 10619,
    	    supmult: 10946,
    	    supplus: 10944,
    	    swarrow: 8601,
    	    topfork: 10970,
    	    triplus: 10809,
    	    tritime: 10811,
    	    uparrow: 8593,
    	    upsilon: 965,
    	    uwangle: 10663,
    	    vzigzag: 10650,
    	    zigrarr: 8669,
    	    Aacute: 193,
    	    Abreve: 258,
    	    Agrave: 192,
    	    Assign: 8788,
    	    Atilde: 195,
    	    Barwed: 8966,
    	    Bumpeq: 8782,
    	    Cacute: 262,
    	    Ccaron: 268,
    	    Ccedil: 199,
    	    Colone: 10868,
    	    Conint: 8751,
    	    CupCap: 8781,
    	    Dagger: 8225,
    	    Dcaron: 270,
    	    DotDot: 8412,
    	    Dstrok: 272,
    	    Eacute: 201,
    	    Ecaron: 282,
    	    Egrave: 200,
    	    Exists: 8707,
    	    ForAll: 8704,
    	    Gammad: 988,
    	    Gbreve: 286,
    	    Gcedil: 290,
    	    HARDcy: 1066,
    	    Hstrok: 294,
    	    Iacute: 205,
    	    Igrave: 204,
    	    Itilde: 296,
    	    Jsercy: 1032,
    	    Kcedil: 310,
    	    Lacute: 313,
    	    Lambda: 923,
    	    Lcaron: 317,
    	    Lcedil: 315,
    	    Lmidot: 319,
    	    Lstrok: 321,
    	    Nacute: 323,
    	    Ncaron: 327,
    	    Ncedil: 325,
    	    Ntilde: 209,
    	    Oacute: 211,
    	    Odblac: 336,
    	    Ograve: 210,
    	    Oslash: 216,
    	    Otilde: 213,
    	    Otimes: 10807,
    	    Racute: 340,
    	    Rarrtl: 10518,
    	    Rcaron: 344,
    	    Rcedil: 342,
    	    SHCHcy: 1065,
    	    SOFTcy: 1068,
    	    Sacute: 346,
    	    Scaron: 352,
    	    Scedil: 350,
    	    Square: 9633,
    	    Subset: 8912,
    	    Supset: 8913,
    	    Tcaron: 356,
    	    Tcedil: 354,
    	    Tstrok: 358,
    	    Uacute: 218,
    	    Ubreve: 364,
    	    Udblac: 368,
    	    Ugrave: 217,
    	    Utilde: 360,
    	    Vdashl: 10982,
    	    Verbar: 8214,
    	    Vvdash: 8874,
    	    Yacute: 221,
    	    Zacute: 377,
    	    Zcaron: 381,
    	    aacute: 225,
    	    abreve: 259,
    	    agrave: 224,
    	    andand: 10837,
    	    angmsd: 8737,
    	    angsph: 8738,
    	    apacir: 10863,
    	    approx: 8776,
    	    atilde: 227,
    	    barvee: 8893,
    	    barwed: 8965,
    	    becaus: 8757,
    	    bernou: 8492,
    	    bigcap: 8898,
    	    bigcup: 8899,
    	    bigvee: 8897,
    	    bkarow: 10509,
    	    bottom: 8869,
    	    bowtie: 8904,
    	    boxbox: 10697,
    	    bprime: 8245,
    	    brvbar: 166,
    	    bullet: 8226,
    	    bumpeq: 8783,
    	    cacute: 263,
    	    capand: 10820,
    	    capcap: 10827,
    	    capcup: 10823,
    	    capdot: 10816,
    	    ccaron: 269,
    	    ccedil: 231,
    	    circeq: 8791,
    	    cirmid: 10991,
    	    colone: 8788,
    	    commat: 64,
    	    compfn: 8728,
    	    conint: 8750,
    	    coprod: 8720,
    	    copysr: 8471,
    	    cularr: 8630,
    	    cupcap: 10822,
    	    cupcup: 10826,
    	    cupdot: 8845,
    	    curarr: 8631,
    	    curren: 164,
    	    cylcty: 9005,
    	    dagger: 8224,
    	    daleth: 8504,
    	    dcaron: 271,
    	    dfisht: 10623,
    	    divide: 247,
    	    divonx: 8903,
    	    dlcorn: 8990,
    	    dlcrop: 8973,
    	    dollar: 36,
    	    drcorn: 8991,
    	    drcrop: 8972,
    	    dstrok: 273,
    	    eacute: 233,
    	    easter: 10862,
    	    ecaron: 283,
    	    ecolon: 8789,
    	    egrave: 232,
    	    egsdot: 10904,
    	    elsdot: 10903,
    	    emptyv: 8709,
    	    emsp13: 8196,
    	    emsp14: 8197,
    	    eparsl: 10723,
    	    eqcirc: 8790,
    	    equals: 61,
    	    equest: 8799,
    	    female: 9792,
    	    ffilig: 64259,
    	    ffllig: 64260,
    	    forall: 8704,
    	    frac12: 189,
    	    frac13: 8531,
    	    frac14: 188,
    	    frac15: 8533,
    	    frac16: 8537,
    	    frac18: 8539,
    	    frac23: 8532,
    	    frac25: 8534,
    	    frac34: 190,
    	    frac35: 8535,
    	    frac38: 8540,
    	    frac45: 8536,
    	    frac56: 8538,
    	    frac58: 8541,
    	    frac78: 8542,
    	    gacute: 501,
    	    gammad: 989,
    	    gbreve: 287,
    	    gesdot: 10880,
    	    gesles: 10900,
    	    gtlPar: 10645,
    	    gtrarr: 10616,
    	    gtrdot: 8919,
    	    gtrsim: 8819,
    	    hairsp: 8202,
    	    hamilt: 8459,
    	    hardcy: 1098,
    	    hearts: 9829,
    	    hellip: 8230,
    	    hercon: 8889,
    	    homtht: 8763,
    	    horbar: 8213,
    	    hslash: 8463,
    	    hstrok: 295,
    	    hybull: 8259,
    	    hyphen: 8208,
    	    iacute: 237,
    	    igrave: 236,
    	    iiiint: 10764,
    	    iinfin: 10716,
    	    incare: 8453,
    	    inodot: 305,
    	    intcal: 8890,
    	    iquest: 191,
    	    isinsv: 8947,
    	    itilde: 297,
    	    jsercy: 1112,
    	    kappav: 1008,
    	    kcedil: 311,
    	    kgreen: 312,
    	    lAtail: 10523,
    	    lacute: 314,
    	    lagran: 8466,
    	    lambda: 955,
    	    langle: 10216,
    	    larrfs: 10525,
    	    larrhk: 8617,
    	    larrlp: 8619,
    	    larrpl: 10553,
    	    larrtl: 8610,
    	    latail: 10521,
    	    lbrace: 123,
    	    lbrack: 91,
    	    lcaron: 318,
    	    lcedil: 316,
    	    ldquor: 8222,
    	    lesdot: 10879,
    	    lesges: 10899,
    	    lfisht: 10620,
    	    lfloor: 8970,
    	    lharul: 10602,
    	    llhard: 10603,
    	    lmidot: 320,
    	    lmoust: 9136,
    	    loplus: 10797,
    	    lowast: 8727,
    	    lowbar: 95,
    	    lparlt: 10643,
    	    lrhard: 10605,
    	    lsaquo: 8249,
    	    lsquor: 8218,
    	    lstrok: 322,
    	    lthree: 8907,
    	    ltimes: 8905,
    	    ltlarr: 10614,
    	    ltrPar: 10646,
    	    mapsto: 8614,
    	    marker: 9646,
    	    mcomma: 10793,
    	    midast: 42,
    	    midcir: 10992,
    	    middot: 183,
    	    minusb: 8863,
    	    minusd: 8760,
    	    mnplus: 8723,
    	    models: 8871,
    	    mstpos: 8766,
    	    nVDash: 8879,
    	    nVdash: 8878,
    	    nacute: 324,
    	    ncaron: 328,
    	    ncedil: 326,
    	    nearhk: 10532,
    	    nequiv: 8802,
    	    nesear: 10536,
    	    nexist: 8708,
    	    nltrie: 8940,
    	    nprcue: 8928,
    	    nrtrie: 8941,
    	    nsccue: 8929,
    	    nsimeq: 8772,
    	    ntilde: 241,
    	    numero: 8470,
    	    nvDash: 8877,
    	    nvHarr: 10500,
    	    nvdash: 8876,
    	    nvlArr: 10498,
    	    nvrArr: 10499,
    	    nwarhk: 10531,
    	    nwnear: 10535,
    	    oacute: 243,
    	    odblac: 337,
    	    odsold: 10684,
    	    ograve: 242,
    	    ominus: 8854,
    	    origof: 8886,
    	    oslash: 248,
    	    otilde: 245,
    	    otimes: 8855,
    	    parsim: 10995,
    	    percnt: 37,
    	    period: 46,
    	    permil: 8240,
    	    phmmat: 8499,
    	    planck: 8463,
    	    plankv: 8463,
    	    plusdo: 8724,
    	    plusdu: 10789,
    	    plusmn: 177,
    	    preceq: 10927,
    	    primes: 8473,
    	    prnsim: 8936,
    	    propto: 8733,
    	    prurel: 8880,
    	    puncsp: 8200,
    	    qprime: 8279,
    	    rAtail: 10524,
    	    racute: 341,
    	    rangle: 10217,
    	    rarrap: 10613,
    	    rarrfs: 10526,
    	    rarrhk: 8618,
    	    rarrlp: 8620,
    	    rarrpl: 10565,
    	    rarrtl: 8611,
    	    ratail: 10522,
    	    rbrace: 125,
    	    rbrack: 93,
    	    rcaron: 345,
    	    rcedil: 343,
    	    rdquor: 8221,
    	    rfisht: 10621,
    	    rfloor: 8971,
    	    rharul: 10604,
    	    rmoust: 9137,
    	    roplus: 10798,
    	    rpargt: 10644,
    	    rsaquo: 8250,
    	    rsquor: 8217,
    	    rthree: 8908,
    	    rtimes: 8906,
    	    sacute: 347,
    	    scaron: 353,
    	    scedil: 351,
    	    scnsim: 8937,
    	    searhk: 10533,
    	    seswar: 10537,
    	    sfrown: 8994,
    	    shchcy: 1097,
    	    sigmaf: 962,
    	    sigmav: 962,
    	    simdot: 10858,
    	    smashp: 10803,
    	    softcy: 1100,
    	    solbar: 9023,
    	    spades: 9824,
    	    sqsube: 8849,
    	    sqsupe: 8850,
    	    square: 9633,
    	    squarf: 9642,
    	    ssetmn: 8726,
    	    ssmile: 8995,
    	    sstarf: 8902,
    	    subdot: 10941,
    	    subset: 8834,
    	    subsim: 10951,
    	    subsub: 10965,
    	    subsup: 10963,
    	    succeq: 10928,
    	    supdot: 10942,
    	    supset: 8835,
    	    supsim: 10952,
    	    supsub: 10964,
    	    supsup: 10966,
    	    swarhk: 10534,
    	    swnwar: 10538,
    	    target: 8982,
    	    tcaron: 357,
    	    tcedil: 355,
    	    telrec: 8981,
    	    there4: 8756,
    	    thetav: 977,
    	    thinsp: 8201,
    	    thksim: 8764,
    	    timesb: 8864,
    	    timesd: 10800,
    	    topbot: 9014,
    	    topcir: 10993,
    	    tprime: 8244,
    	    tridot: 9708,
    	    tstrok: 359,
    	    uacute: 250,
    	    ubreve: 365,
    	    udblac: 369,
    	    ufisht: 10622,
    	    ugrave: 249,
    	    ulcorn: 8988,
    	    ulcrop: 8975,
    	    urcorn: 8989,
    	    urcrop: 8974,
    	    utilde: 361,
    	    vangrt: 10652,
    	    varphi: 966,
    	    varrho: 1009,
    	    veebar: 8891,
    	    vellip: 8942,
    	    verbar: 124,
    	    wedbar: 10847,
    	    wedgeq: 8793,
    	    weierp: 8472,
    	    wreath: 8768,
    	    xoplus: 10753,
    	    xotime: 10754,
    	    xsqcup: 10758,
    	    xuplus: 10756,
    	    xwedge: 8896,
    	    yacute: 253,
    	    zacute: 378,
    	    zcaron: 382,
    	    zeetrf: 8488,
    	    AElig: 198,
    	    Acirc: 194,
    	    Alpha: 913,
    	    Amacr: 256,
    	    Aogon: 260,
    	    Aring: 197,
    	    Breve: 728,
    	    Ccirc: 264,
    	    Colon: 8759,
    	    Cross: 10799,
    	    Dashv: 10980,
    	    Delta: 916,
    	    Ecirc: 202,
    	    Emacr: 274,
    	    Eogon: 280,
    	    Equal: 10869,
    	    Gamma: 915,
    	    Gcirc: 284,
    	    Hacek: 711,
    	    Hcirc: 292,
    	    IJlig: 306,
    	    Icirc: 206,
    	    Imacr: 298,
    	    Iogon: 302,
    	    Iukcy: 1030,
    	    Jcirc: 308,
    	    Jukcy: 1028,
    	    Kappa: 922,
    	    OElig: 338,
    	    Ocirc: 212,
    	    Omacr: 332,
    	    Omega: 937,
    	    Prime: 8243,
    	    RBarr: 10512,
    	    Scirc: 348,
    	    Sigma: 931,
    	    THORN: 222,
    	    TRADE: 8482,
    	    TSHcy: 1035,
    	    Theta: 920,
    	    Tilde: 8764,
    	    Ubrcy: 1038,
    	    Ucirc: 219,
    	    Umacr: 362,
    	    Union: 8899,
    	    Uogon: 370,
    	    UpTee: 8869,
    	    Uring: 366,
    	    VDash: 8875,
    	    Vdash: 8873,
    	    Wcirc: 372,
    	    Wedge: 8896,
    	    Ycirc: 374,
    	    acirc: 226,
    	    acute: 180,
    	    aelig: 230,
    	    aleph: 8501,
    	    alpha: 945,
    	    amacr: 257,
    	    amalg: 10815,
    	    angle: 8736,
    	    angrt: 8735,
    	    angst: 8491,
    	    aogon: 261,
    	    aring: 229,
    	    asymp: 8776,
    	    awint: 10769,
    	    bcong: 8780,
    	    bdquo: 8222,
    	    bepsi: 1014,
    	    blank: 9251,
    	    blk12: 9618,
    	    blk14: 9617,
    	    blk34: 9619,
    	    block: 9608,
    	    boxDL: 9559,
    	    boxDR: 9556,
    	    boxDl: 9558,
    	    boxDr: 9555,
    	    boxHD: 9574,
    	    boxHU: 9577,
    	    boxHd: 9572,
    	    boxHu: 9575,
    	    boxUL: 9565,
    	    boxUR: 9562,
    	    boxUl: 9564,
    	    boxUr: 9561,
    	    boxVH: 9580,
    	    boxVL: 9571,
    	    boxVR: 9568,
    	    boxVh: 9579,
    	    boxVl: 9570,
    	    boxVr: 9567,
    	    boxdL: 9557,
    	    boxdR: 9554,
    	    boxdl: 9488,
    	    boxdr: 9484,
    	    boxhD: 9573,
    	    boxhU: 9576,
    	    boxhd: 9516,
    	    boxhu: 9524,
    	    boxuL: 9563,
    	    boxuR: 9560,
    	    boxul: 9496,
    	    boxur: 9492,
    	    boxvH: 9578,
    	    boxvL: 9569,
    	    boxvR: 9566,
    	    boxvh: 9532,
    	    boxvl: 9508,
    	    boxvr: 9500,
    	    breve: 728,
    	    bsemi: 8271,
    	    bsime: 8909,
    	    bsolb: 10693,
    	    bumpE: 10926,
    	    bumpe: 8783,
    	    caret: 8257,
    	    caron: 711,
    	    ccaps: 10829,
    	    ccirc: 265,
    	    ccups: 10828,
    	    cedil: 184,
    	    check: 10003,
    	    clubs: 9827,
    	    colon: 58,
    	    comma: 44,
    	    crarr: 8629,
    	    cross: 10007,
    	    csube: 10961,
    	    csupe: 10962,
    	    ctdot: 8943,
    	    cuepr: 8926,
    	    cuesc: 8927,
    	    cupor: 10821,
    	    cuvee: 8910,
    	    cuwed: 8911,
    	    cwint: 8753,
    	    dashv: 8867,
    	    dblac: 733,
    	    ddarr: 8650,
    	    delta: 948,
    	    dharl: 8643,
    	    dharr: 8642,
    	    diams: 9830,
    	    disin: 8946,
    	    doteq: 8784,
    	    dtdot: 8945,
    	    dtrif: 9662,
    	    duarr: 8693,
    	    duhar: 10607,
    	    eDDot: 10871,
    	    ecirc: 234,
    	    efDot: 8786,
    	    emacr: 275,
    	    empty: 8709,
    	    eogon: 281,
    	    eplus: 10865,
    	    epsiv: 949,
    	    eqsim: 8770,
    	    equiv: 8801,
    	    erDot: 8787,
    	    erarr: 10609,
    	    esdot: 8784,
    	    exist: 8707,
    	    fflig: 64256,
    	    filig: 64257,
    	    fllig: 64258,
    	    fltns: 9649,
    	    forkv: 10969,
    	    frasl: 8260,
    	    frown: 8994,
    	    gamma: 947,
    	    gcirc: 285,
    	    gescc: 10921,
    	    gimel: 8503,
    	    gneqq: 8809,
    	    gnsim: 8935,
    	    grave: 96,
    	    gsime: 10894,
    	    gsiml: 10896,
    	    gtcir: 10874,
    	    gtdot: 8919,
    	    harrw: 8621,
    	    hcirc: 293,
    	    hoarr: 8703,
    	    icirc: 238,
    	    iexcl: 161,
    	    iiint: 8749,
    	    iiota: 8489,
    	    ijlig: 307,
    	    imacr: 299,
    	    image: 8465,
    	    imath: 305,
    	    imped: 437,
    	    infin: 8734,
    	    iogon: 303,
    	    iprod: 10812,
    	    isinE: 8953,
    	    isins: 8948,
    	    isinv: 8712,
    	    iukcy: 1110,
    	    jcirc: 309,
    	    jmath: 567,
    	    jukcy: 1108,
    	    kappa: 954,
    	    lAarr: 8666,
    	    lBarr: 10510,
    	    langd: 10641,
    	    laquo: 171,
    	    larrb: 8676,
    	    lbarr: 10508,
    	    lbbrk: 10098,
    	    lbrke: 10635,
    	    lceil: 8968,
    	    ldquo: 8220,
    	    lescc: 10920,
    	    lhard: 8637,
    	    lharu: 8636,
    	    lhblk: 9604,
    	    llarr: 8647,
    	    lltri: 9722,
    	    lneqq: 8808,
    	    lnsim: 8934,
    	    loang: 10220,
    	    loarr: 8701,
    	    lobrk: 10214,
    	    lopar: 10629,
    	    lrarr: 8646,
    	    lrhar: 8651,
    	    lrtri: 8895,
    	    lsime: 10893,
    	    lsimg: 10895,
    	    lsquo: 8216,
    	    ltcir: 10873,
    	    ltdot: 8918,
    	    ltrie: 8884,
    	    ltrif: 9666,
    	    mDDot: 8762,
    	    mdash: 8212,
    	    micro: 181,
    	    minus: 8722,
    	    mumap: 8888,
    	    nabla: 8711,
    	    napos: 329,
    	    natur: 9838,
    	    ncong: 8775,
    	    ndash: 8211,
    	    neArr: 8663,
    	    nearr: 8599,
    	    ngsim: 8821,
    	    nhArr: 8654,
    	    nharr: 8622,
    	    nhpar: 10994,
    	    nlArr: 8653,
    	    nlarr: 8602,
    	    nless: 8814,
    	    nlsim: 8820,
    	    nltri: 8938,
    	    notin: 8713,
    	    notni: 8716,
    	    nprec: 8832,
    	    nrArr: 8655,
    	    nrarr: 8603,
    	    nrtri: 8939,
    	    nsime: 8772,
    	    nsmid: 8740,
    	    nspar: 8742,
    	    nsube: 8840,
    	    nsucc: 8833,
    	    nsupe: 8841,
    	    numsp: 8199,
    	    nwArr: 8662,
    	    nwarr: 8598,
    	    ocirc: 244,
    	    odash: 8861,
    	    oelig: 339,
    	    ofcir: 10687,
    	    ohbar: 10677,
    	    olarr: 8634,
    	    olcir: 10686,
    	    oline: 8254,
    	    omacr: 333,
    	    omega: 969,
    	    operp: 10681,
    	    oplus: 8853,
    	    orarr: 8635,
    	    order: 8500,
    	    ovbar: 9021,
    	    parsl: 11005,
    	    phone: 9742,
    	    plusb: 8862,
    	    pluse: 10866,
    	    pound: 163,
    	    prcue: 8828,
    	    prime: 8242,
    	    prnap: 10937,
    	    prsim: 8830,
    	    quest: 63,
    	    rAarr: 8667,
    	    rBarr: 10511,
    	    radic: 8730,
    	    rangd: 10642,
    	    range: 10661,
    	    raquo: 187,
    	    rarrb: 8677,
    	    rarrc: 10547,
    	    rarrw: 8605,
    	    ratio: 8758,
    	    rbarr: 10509,
    	    rbbrk: 10099,
    	    rbrke: 10636,
    	    rceil: 8969,
    	    rdquo: 8221,
    	    reals: 8477,
    	    rhard: 8641,
    	    rharu: 8640,
    	    rlarr: 8644,
    	    rlhar: 8652,
    	    rnmid: 10990,
    	    roang: 10221,
    	    roarr: 8702,
    	    robrk: 10215,
    	    ropar: 10630,
    	    rrarr: 8649,
    	    rsquo: 8217,
    	    rtrie: 8885,
    	    rtrif: 9656,
    	    sbquo: 8218,
    	    sccue: 8829,
    	    scirc: 349,
    	    scnap: 10938,
    	    scsim: 8831,
    	    sdotb: 8865,
    	    sdote: 10854,
    	    seArr: 8664,
    	    searr: 8600,
    	    setmn: 8726,
    	    sharp: 9839,
    	    sigma: 963,
    	    simeq: 8771,
    	    simgE: 10912,
    	    simlE: 10911,
    	    simne: 8774,
    	    slarr: 8592,
    	    smile: 8995,
    	    sqcap: 8851,
    	    sqcup: 8852,
    	    sqsub: 8847,
    	    sqsup: 8848,
    	    srarr: 8594,
    	    starf: 9733,
    	    strns: 175,
    	    subnE: 10955,
    	    subne: 8842,
    	    supnE: 10956,
    	    supne: 8843,
    	    swArr: 8665,
    	    swarr: 8601,
    	    szlig: 223,
    	    theta: 952,
    	    thkap: 8776,
    	    thorn: 254,
    	    tilde: 732,
    	    times: 215,
    	    trade: 8482,
    	    trisb: 10701,
    	    tshcy: 1115,
    	    twixt: 8812,
    	    ubrcy: 1118,
    	    ucirc: 251,
    	    udarr: 8645,
    	    udhar: 10606,
    	    uharl: 8639,
    	    uharr: 8638,
    	    uhblk: 9600,
    	    ultri: 9720,
    	    umacr: 363,
    	    uogon: 371,
    	    uplus: 8846,
    	    upsih: 978,
    	    uring: 367,
    	    urtri: 9721,
    	    utdot: 8944,
    	    utrif: 9652,
    	    uuarr: 8648,
    	    vBarv: 10985,
    	    vDash: 8872,
    	    varpi: 982,
    	    vdash: 8866,
    	    veeeq: 8794,
    	    vltri: 8882,
    	    vprop: 8733,
    	    vrtri: 8883,
    	    wcirc: 373,
    	    wedge: 8743,
    	    xcirc: 9711,
    	    xdtri: 9661,
    	    xhArr: 10234,
    	    xharr: 10231,
    	    xlArr: 10232,
    	    xlarr: 10229,
    	    xodot: 10752,
    	    xrArr: 10233,
    	    xrarr: 10230,
    	    xutri: 9651,
    	    ycirc: 375,
    	    Aopf: 120120,
    	    Ascr: 119964,
    	    Auml: 196,
    	    Barv: 10983,
    	    Beta: 914,
    	    Bopf: 120121,
    	    Bscr: 8492,
    	    CHcy: 1063,
    	    COPY: 169,
    	    Cdot: 266,
    	    Copf: 8450,
    	    Cscr: 119966,
    	    DJcy: 1026,
    	    DScy: 1029,
    	    DZcy: 1039,
    	    Darr: 8609,
    	    Dopf: 120123,
    	    Dscr: 119967,
    	    Edot: 278,
    	    Eopf: 120124,
    	    Escr: 8496,
    	    Esim: 10867,
    	    Euml: 203,
    	    Fopf: 120125,
    	    Fscr: 8497,
    	    GJcy: 1027,
    	    Gdot: 288,
    	    Gopf: 120126,
    	    Gscr: 119970,
    	    Hopf: 8461,
    	    Hscr: 8459,
    	    IEcy: 1045,
    	    IOcy: 1025,
    	    Idot: 304,
    	    Iopf: 120128,
    	    Iota: 921,
    	    Iscr: 8464,
    	    Iuml: 207,
    	    Jopf: 120129,
    	    Jscr: 119973,
    	    KHcy: 1061,
    	    KJcy: 1036,
    	    Kopf: 120130,
    	    Kscr: 119974,
    	    LJcy: 1033,
    	    Lang: 10218,
    	    Larr: 8606,
    	    Lopf: 120131,
    	    Lscr: 8466,
    	    Mopf: 120132,
    	    Mscr: 8499,
    	    NJcy: 1034,
    	    Nopf: 8469,
    	    Nscr: 119977,
    	    Oopf: 120134,
    	    Oscr: 119978,
    	    Ouml: 214,
    	    Popf: 8473,
    	    Pscr: 119979,
    	    QUOT: 34,
    	    Qopf: 8474,
    	    Qscr: 119980,
    	    Rang: 10219,
    	    Rarr: 8608,
    	    Ropf: 8477,
    	    Rscr: 8475,
    	    SHcy: 1064,
    	    Sopf: 120138,
    	    Sqrt: 8730,
    	    Sscr: 119982,
    	    Star: 8902,
    	    TScy: 1062,
    	    Topf: 120139,
    	    Tscr: 119983,
    	    Uarr: 8607,
    	    Uopf: 120140,
    	    Upsi: 978,
    	    Uscr: 119984,
    	    Uuml: 220,
    	    Vbar: 10987,
    	    Vert: 8214,
    	    Vopf: 120141,
    	    Vscr: 119985,
    	    Wopf: 120142,
    	    Wscr: 119986,
    	    Xopf: 120143,
    	    Xscr: 119987,
    	    YAcy: 1071,
    	    YIcy: 1031,
    	    YUcy: 1070,
    	    Yopf: 120144,
    	    Yscr: 119988,
    	    Yuml: 376,
    	    ZHcy: 1046,
    	    Zdot: 379,
    	    Zeta: 918,
    	    Zopf: 8484,
    	    Zscr: 119989,
    	    andd: 10844,
    	    andv: 10842,
    	    ange: 10660,
    	    aopf: 120146,
    	    apid: 8779,
    	    apos: 39,
    	    ascr: 119990,
    	    auml: 228,
    	    bNot: 10989,
    	    bbrk: 9141,
    	    beta: 946,
    	    beth: 8502,
    	    bnot: 8976,
    	    bopf: 120147,
    	    boxH: 9552,
    	    boxV: 9553,
    	    boxh: 9472,
    	    boxv: 9474,
    	    bscr: 119991,
    	    bsim: 8765,
    	    bsol: 92,
    	    bull: 8226,
    	    bump: 8782,
    	    cdot: 267,
    	    cent: 162,
    	    chcy: 1095,
    	    cirE: 10691,
    	    circ: 710,
    	    cire: 8791,
    	    comp: 8705,
    	    cong: 8773,
    	    copf: 120148,
    	    copy: 169,
    	    cscr: 119992,
    	    csub: 10959,
    	    csup: 10960,
    	    dArr: 8659,
    	    dHar: 10597,
    	    darr: 8595,
    	    dash: 8208,
    	    diam: 8900,
    	    djcy: 1106,
    	    dopf: 120149,
    	    dscr: 119993,
    	    dscy: 1109,
    	    dsol: 10742,
    	    dtri: 9663,
    	    dzcy: 1119,
    	    eDot: 8785,
    	    ecir: 8790,
    	    edot: 279,
    	    emsp: 8195,
    	    ensp: 8194,
    	    eopf: 120150,
    	    epar: 8917,
    	    epsi: 1013,
    	    escr: 8495,
    	    esim: 8770,
    	    euml: 235,
    	    euro: 8364,
    	    excl: 33,
    	    flat: 9837,
    	    fnof: 402,
    	    fopf: 120151,
    	    fork: 8916,
    	    fscr: 119995,
    	    gdot: 289,
    	    geqq: 8807,
    	    gjcy: 1107,
    	    gnap: 10890,
    	    gneq: 10888,
    	    gopf: 120152,
    	    gscr: 8458,
    	    gsim: 8819,
    	    gtcc: 10919,
    	    hArr: 8660,
    	    half: 189,
    	    harr: 8596,
    	    hbar: 8463,
    	    hopf: 120153,
    	    hscr: 119997,
    	    iecy: 1077,
    	    imof: 8887,
    	    iocy: 1105,
    	    iopf: 120154,
    	    iota: 953,
    	    iscr: 119998,
    	    isin: 8712,
    	    iuml: 239,
    	    jopf: 120155,
    	    jscr: 119999,
    	    khcy: 1093,
    	    kjcy: 1116,
    	    kopf: 120156,
    	    kscr: 120000,
    	    lArr: 8656,
    	    lHar: 10594,
    	    lang: 10216,
    	    larr: 8592,
    	    late: 10925,
    	    lcub: 123,
    	    ldca: 10550,
    	    ldsh: 8626,
    	    leqq: 8806,
    	    ljcy: 1113,
    	    lnap: 10889,
    	    lneq: 10887,
    	    lopf: 120157,
    	    lozf: 10731,
    	    lpar: 40,
    	    lscr: 120001,
    	    lsim: 8818,
    	    lsqb: 91,
    	    ltcc: 10918,
    	    ltri: 9667,
    	    macr: 175,
    	    male: 9794,
    	    malt: 10016,
    	    mlcp: 10971,
    	    mldr: 8230,
    	    mopf: 120158,
    	    mscr: 120002,
    	    nbsp: 160,
    	    ncap: 10819,
    	    ncup: 10818,
    	    ngeq: 8817,
    	    ngtr: 8815,
    	    nisd: 8954,
    	    njcy: 1114,
    	    nldr: 8229,
    	    nleq: 8816,
    	    nmid: 8740,
    	    nopf: 120159,
    	    npar: 8742,
    	    nscr: 120003,
    	    nsim: 8769,
    	    nsub: 8836,
    	    nsup: 8837,
    	    ntgl: 8825,
    	    ntlg: 8824,
    	    oast: 8859,
    	    ocir: 8858,
    	    odiv: 10808,
    	    odot: 8857,
    	    ogon: 731,
    	    oint: 8750,
    	    omid: 10678,
    	    oopf: 120160,
    	    opar: 10679,
    	    ordf: 170,
    	    ordm: 186,
    	    oror: 10838,
    	    oscr: 8500,
    	    osol: 8856,
    	    ouml: 246,
    	    para: 182,
    	    part: 8706,
    	    perp: 8869,
    	    phiv: 966,
    	    plus: 43,
    	    popf: 120161,
    	    prap: 10935,
    	    prec: 8826,
    	    prnE: 10933,
    	    prod: 8719,
    	    prop: 8733,
    	    pscr: 120005,
    	    qint: 10764,
    	    qopf: 120162,
    	    qscr: 120006,
    	    quot: 34,
    	    rArr: 8658,
    	    rHar: 10596,
    	    race: 10714,
    	    rang: 10217,
    	    rarr: 8594,
    	    rcub: 125,
    	    rdca: 10551,
    	    rdsh: 8627,
    	    real: 8476,
    	    rect: 9645,
    	    rhov: 1009,
    	    ring: 730,
    	    ropf: 120163,
    	    rpar: 41,
    	    rscr: 120007,
    	    rsqb: 93,
    	    rtri: 9657,
    	    scap: 10936,
    	    scnE: 10934,
    	    sdot: 8901,
    	    sect: 167,
    	    semi: 59,
    	    sext: 10038,
    	    shcy: 1096,
    	    sime: 8771,
    	    simg: 10910,
    	    siml: 10909,
    	    smid: 8739,
    	    smte: 10924,
    	    solb: 10692,
    	    sopf: 120164,
    	    spar: 8741,
    	    squf: 9642,
    	    sscr: 120008,
    	    star: 9734,
    	    subE: 10949,
    	    sube: 8838,
    	    succ: 8827,
    	    sung: 9834,
    	    sup1: 185,
    	    sup2: 178,
    	    sup3: 179,
    	    supE: 10950,
    	    supe: 8839,
    	    tbrk: 9140,
    	    tdot: 8411,
    	    tint: 8749,
    	    toea: 10536,
    	    topf: 120165,
    	    tosa: 10537,
    	    trie: 8796,
    	    tscr: 120009,
    	    tscy: 1094,
    	    uArr: 8657,
    	    uHar: 10595,
    	    uarr: 8593,
    	    uopf: 120166,
    	    upsi: 965,
    	    uscr: 120010,
    	    utri: 9653,
    	    uuml: 252,
    	    vArr: 8661,
    	    vBar: 10984,
    	    varr: 8597,
    	    vert: 124,
    	    vopf: 120167,
    	    vscr: 120011,
    	    wopf: 120168,
    	    wscr: 120012,
    	    xcap: 8898,
    	    xcup: 8899,
    	    xmap: 10236,
    	    xnis: 8955,
    	    xopf: 120169,
    	    xscr: 120013,
    	    xvee: 8897,
    	    yacy: 1103,
    	    yicy: 1111,
    	    yopf: 120170,
    	    yscr: 120014,
    	    yucy: 1102,
    	    yuml: 255,
    	    zdot: 380,
    	    zeta: 950,
    	    zhcy: 1078,
    	    zopf: 120171,
    	    zscr: 120015,
    	    zwnj: 8204,
    	    AMP: 38,
    	    Acy: 1040,
    	    Afr: 120068,
    	    And: 10835,
    	    Bcy: 1041,
    	    Bfr: 120069,
    	    Cap: 8914,
    	    Cfr: 8493,
    	    Chi: 935,
    	    Cup: 8915,
    	    Dcy: 1044,
    	    Del: 8711,
    	    Dfr: 120071,
    	    Dot: 168,
    	    ENG: 330,
    	    ETH: 208,
    	    Ecy: 1069,
    	    Efr: 120072,
    	    Eta: 919,
    	    Fcy: 1060,
    	    Ffr: 120073,
    	    Gcy: 1043,
    	    Gfr: 120074,
    	    Hat: 94,
    	    Hfr: 8460,
    	    Icy: 1048,
    	    Ifr: 8465,
    	    Int: 8748,
    	    Jcy: 1049,
    	    Jfr: 120077,
    	    Kcy: 1050,
    	    Kfr: 120078,
    	    Lcy: 1051,
    	    Lfr: 120079,
    	    Lsh: 8624,
    	    Map: 10501,
    	    Mcy: 1052,
    	    Mfr: 120080,
    	    Ncy: 1053,
    	    Nfr: 120081,
    	    Not: 10988,
    	    Ocy: 1054,
    	    Ofr: 120082,
    	    Pcy: 1055,
    	    Pfr: 120083,
    	    Phi: 934,
    	    Psi: 936,
    	    Qfr: 120084,
    	    REG: 174,
    	    Rcy: 1056,
    	    Rfr: 8476,
    	    Rho: 929,
    	    Rsh: 8625,
    	    Scy: 1057,
    	    Sfr: 120086,
    	    Sub: 8912,
    	    Sum: 8721,
    	    Sup: 8913,
    	    Tab: 9,
    	    Tau: 932,
    	    Tcy: 1058,
    	    Tfr: 120087,
    	    Ucy: 1059,
    	    Ufr: 120088,
    	    Vcy: 1042,
    	    Vee: 8897,
    	    Vfr: 120089,
    	    Wfr: 120090,
    	    Xfr: 120091,
    	    Ycy: 1067,
    	    Yfr: 120092,
    	    Zcy: 1047,
    	    Zfr: 8488,
    	    acd: 8767,
    	    acy: 1072,
    	    afr: 120094,
    	    amp: 38,
    	    and: 8743,
    	    ang: 8736,
    	    apE: 10864,
    	    ape: 8778,
    	    ast: 42,
    	    bcy: 1073,
    	    bfr: 120095,
    	    bot: 8869,
    	    cap: 8745,
    	    cfr: 120096,
    	    chi: 967,
    	    cir: 9675,
    	    cup: 8746,
    	    dcy: 1076,
    	    deg: 176,
    	    dfr: 120097,
    	    die: 168,
    	    div: 247,
    	    dot: 729,
    	    ecy: 1101,
    	    efr: 120098,
    	    egs: 10902,
    	    ell: 8467,
    	    els: 10901,
    	    eng: 331,
    	    eta: 951,
    	    eth: 240,
    	    fcy: 1092,
    	    ffr: 120099,
    	    gEl: 10892,
    	    gap: 10886,
    	    gcy: 1075,
    	    gel: 8923,
    	    geq: 8805,
    	    ges: 10878,
    	    gfr: 120100,
    	    ggg: 8921,
    	    glE: 10898,
    	    gla: 10917,
    	    glj: 10916,
    	    gnE: 8809,
    	    gne: 10888,
    	    hfr: 120101,
    	    icy: 1080,
    	    iff: 8660,
    	    ifr: 120102,
    	    int: 8747,
    	    jcy: 1081,
    	    jfr: 120103,
    	    kcy: 1082,
    	    kfr: 120104,
    	    lEg: 10891,
    	    lap: 10885,
    	    lat: 10923,
    	    lcy: 1083,
    	    leg: 8922,
    	    leq: 8804,
    	    les: 10877,
    	    lfr: 120105,
    	    lgE: 10897,
    	    lnE: 8808,
    	    lne: 10887,
    	    loz: 9674,
    	    lrm: 8206,
    	    lsh: 8624,
    	    map: 8614,
    	    mcy: 1084,
    	    mfr: 120106,
    	    mho: 8487,
    	    mid: 8739,
    	    nap: 8777,
    	    ncy: 1085,
    	    nfr: 120107,
    	    nge: 8817,
    	    ngt: 8815,
    	    nis: 8956,
    	    niv: 8715,
    	    nle: 8816,
    	    nlt: 8814,
    	    not: 172,
    	    npr: 8832,
    	    nsc: 8833,
    	    num: 35,
    	    ocy: 1086,
    	    ofr: 120108,
    	    ogt: 10689,
    	    ohm: 8486,
    	    olt: 10688,
    	    ord: 10845,
    	    orv: 10843,
    	    par: 8741,
    	    pcy: 1087,
    	    pfr: 120109,
    	    phi: 966,
    	    piv: 982,
    	    prE: 10931,
    	    pre: 10927,
    	    psi: 968,
    	    qfr: 120110,
    	    rcy: 1088,
    	    reg: 174,
    	    rfr: 120111,
    	    rho: 961,
    	    rlm: 8207,
    	    rsh: 8625,
    	    scE: 10932,
    	    sce: 10928,
    	    scy: 1089,
    	    sfr: 120112,
    	    shy: 173,
    	    sim: 8764,
    	    smt: 10922,
    	    sol: 47,
    	    squ: 9633,
    	    sub: 8834,
    	    sum: 8721,
    	    sup: 8835,
    	    tau: 964,
    	    tcy: 1090,
    	    tfr: 120113,
    	    top: 8868,
    	    ucy: 1091,
    	    ufr: 120114,
    	    uml: 168,
    	    vcy: 1074,
    	    vee: 8744,
    	    vfr: 120115,
    	    wfr: 120116,
    	    xfr: 120117,
    	    ycy: 1099,
    	    yen: 165,
    	    yfr: 120118,
    	    zcy: 1079,
    	    zfr: 120119,
    	    zwj: 8205,
    	    DD: 8517,
    	    GT: 62,
    	    Gg: 8921,
    	    Gt: 8811,
    	    Im: 8465,
    	    LT: 60,
    	    Ll: 8920,
    	    Lt: 8810,
    	    Mu: 924,
    	    Nu: 925,
    	    Or: 10836,
    	    Pi: 928,
    	    Pr: 10939,
    	    Re: 8476,
    	    Sc: 10940,
    	    Xi: 926,
    	    ac: 8766,
    	    af: 8289,
    	    ap: 8776,
    	    dd: 8518,
    	    ee: 8519,
    	    eg: 10906,
    	    el: 10905,
    	    gE: 8807,
    	    ge: 8805,
    	    gg: 8811,
    	    gl: 8823,
    	    gt: 62,
    	    ic: 8291,
    	    ii: 8520,
    	    in: 8712,
    	    it: 8290,
    	    lE: 8806,
    	    le: 8804,
    	    lg: 8822,
    	    ll: 8810,
    	    lt: 60,
    	    mp: 8723,
    	    mu: 956,
    	    ne: 8800,
    	    ni: 8715,
    	    nu: 957,
    	    oS: 9416,
    	    or: 8744,
    	    pi: 960,
    	    pm: 177,
    	    pr: 8826,
    	    rx: 8478,
    	    sc: 8827,
    	    wp: 8472,
    	    wr: 8768,
    	    xi: 958,
    	};

    	const windows_1252 = [
    	    8364,
    	    129,
    	    8218,
    	    402,
    	    8222,
    	    8230,
    	    8224,
    	    8225,
    	    710,
    	    8240,
    	    352,
    	    8249,
    	    338,
    	    141,
    	    381,
    	    143,
    	    144,
    	    8216,
    	    8217,
    	    8220,
    	    8221,
    	    8226,
    	    8211,
    	    8212,
    	    732,
    	    8482,
    	    353,
    	    8250,
    	    339,
    	    157,
    	    382,
    	    376,
    	];
    	const entity_pattern = new RegExp(`&(#?(?:x[\\w\\d]+|\\d+|${Object.keys(entities).join('|')}))(?:;|\\b)`, 'g');
    	function decode_character_references(html) {
    	    return html.replace(entity_pattern, (match, entity) => {
    	        let code;
    	        // Handle named entities
    	        if (entity[0] !== '#') {
    	            code = entities[entity];
    	        }
    	        else if (entity[1] === 'x') {
    	            code = parseInt(entity.substring(2), 16);
    	        }
    	        else {
    	            code = parseInt(entity.substring(1), 10);
    	        }
    	        if (!code) {
    	            return match;
    	        }
    	        return String.fromCodePoint(validate_code(code));
    	    });
    	}
    	const NUL = 0;
    	// some code points are verboten. If we were inserting HTML, the browser would replace the illegal
    	// code points with alternatives in some cases - since we're bypassing that mechanism, we need
    	// to replace them ourselves
    	//
    	// Source: http://en.wikipedia.org/wiki/Character_encodings_in_HTML#Illegal_characters
    	function validate_code(code) {
    	    // line feed becomes generic whitespace
    	    if (code === 10) {
    	        return 32;
    	    }
    	    // ASCII range. (Why someone would use HTML entities for ASCII characters I don't know, but...)
    	    if (code < 128) {
    	        return code;
    	    }
    	    // code points 128-159 are dealt with leniently by browsers, but they're incorrect. We need
    	    // to correct the mistake or we'll end up with missing € signs and so on
    	    if (code <= 159) {
    	        return windows_1252[code - 128];
    	    }
    	    // basic multilingual plane
    	    if (code < 55296) {
    	        return code;
    	    }
    	    // UTF-16 surrogate halves
    	    if (code <= 57343) {
    	        return NUL;
    	    }
    	    // rest of the basic multilingual plane
    	    if (code <= 65535) {
    	        return code;
    	    }
    	    // supplementary multilingual plane 0x10000 - 0x1ffff
    	    if (code >= 65536 && code <= 131071) {
    	        return code;
    	    }
    	    // supplementary ideographic plane 0x20000 - 0x2ffff
    	    if (code >= 131072 && code <= 196607) {
    	        return code;
    	    }
    	    return NUL;
    	}
    	// based on http://developers.whatwg.org/syntax.html#syntax-tag-omission
    	const disallowed_contents = new Map([
    	    ['li', new Set(['li'])],
    	    ['dt', new Set(['dt', 'dd'])],
    	    ['dd', new Set(['dt', 'dd'])],
    	    [
    	        'p',
    	        new Set('address article aside blockquote div dl fieldset footer form h1 h2 h3 h4 h5 h6 header hgroup hr main menu nav ol p pre section table ul'.split(' ')),
    	    ],
    	    ['rt', new Set(['rt', 'rp'])],
    	    ['rp', new Set(['rt', 'rp'])],
    	    ['optgroup', new Set(['optgroup'])],
    	    ['option', new Set(['option', 'optgroup'])],
    	    ['thead', new Set(['tbody', 'tfoot'])],
    	    ['tbody', new Set(['tbody', 'tfoot'])],
    	    ['tfoot', new Set(['tbody'])],
    	    ['tr', new Set(['tr', 'tbody'])],
    	    ['td', new Set(['td', 'th', 'tr'])],
    	    ['th', new Set(['td', 'th', 'tr'])],
    	]);
    	// can this be a child of the parent element, or does it implicitly
    	// close it, like `<li>one<li>two`?
    	function closing_tag_omitted(current, next) {
    	    if (disallowed_contents.has(current)) {
    	        if (!next || disallowed_contents.get(current).has(next)) {
    	            return true;
    	        }
    	    }
    	    return false;
    	}

    	// Adapted from https://github.com/acornjs/acorn/blob/6584815dca7440e00de841d1dad152302fdd7ca5/src/tokenize.js
    	// Reproduced under MIT License https://github.com/acornjs/acorn/blob/master/LICENSE
    	function full_char_code_at(str, i) {
    	    const code = str.charCodeAt(i);
    	    if (code <= 0xd7ff || code >= 0xe000)
    	        return code;
    	    const next = str.charCodeAt(i + 1);
    	    return (code << 10) + next - 0x35fdc00;
    	}

    	const globals = new Set([
    	    'alert',
    	    'Array',
    	    'Boolean',
    	    'confirm',
    	    'console',
    	    'Date',
    	    'decodeURI',
    	    'decodeURIComponent',
    	    'document',
    	    'encodeURI',
    	    'encodeURIComponent',
    	    'Error',
    	    'EvalError',
    	    'Event',
    	    'history',
    	    'Infinity',
    	    'InternalError',
    	    'Intl',
    	    'isFinite',
    	    'isNaN',
    	    'JSON',
    	    'localStorage',
    	    'location',
    	    'Map',
    	    'Math',
    	    'NaN',
    	    'navigator',
    	    'Number',
    	    'Object',
    	    'parseFloat',
    	    'parseInt',
    	    'process',
    	    'Promise',
    	    'prompt',
    	    'RangeError',
    	    'ReferenceError',
    	    'RegExp',
    	    'sessionStorage',
    	    'Set',
    	    'String',
    	    'SyntaxError',
    	    'TypeError',
    	    'undefined',
    	    'URIError',
    	    'window'
    	]);
    	const reserved = new Set([
    	    'arguments',
    	    'await',
    	    'break',
    	    'case',
    	    'catch',
    	    'class',
    	    'const',
    	    'continue',
    	    'debugger',
    	    'default',
    	    'delete',
    	    'do',
    	    'else',
    	    'enum',
    	    'eval',
    	    'export',
    	    'extends',
    	    'false',
    	    'finally',
    	    'for',
    	    'function',
    	    'if',
    	    'implements',
    	    'import',
    	    'in',
    	    'instanceof',
    	    'interface',
    	    'let',
    	    'new',
    	    'null',
    	    'package',
    	    'private',
    	    'protected',
    	    'public',
    	    'return',
    	    'static',
    	    'super',
    	    'switch',
    	    'this',
    	    'throw',
    	    'true',
    	    'try',
    	    'typeof',
    	    'var',
    	    'void',
    	    'while',
    	    'with',
    	    'yield',
    	]);
    	const void_element_names = /^(?:area|base|br|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/;
    	function is_void(name) {
    	    return void_element_names.test(name) || name.toLowerCase() === '!doctype';
    	}
    	function is_valid(str) {
    	    let i = 0;
    	    while (i < str.length) {
    	        const code = full_char_code_at(str, i);
    	        if (!(i === 0 ? isIdentifierStart : isIdentifierChar)(code, true))
    	            return false;
    	        i += code <= 0xffff ? 1 : 2;
    	    }
    	    return true;
    	}
    	function sanitize(name) {
    	    return name
    	        .replace(/[^a-zA-Z0-9_]+/g, '_')
    	        .replace(/^_/, '')
    	        .replace(/_$/, '')
    	        .replace(/^[0-9]/, '_$&');
    	}

    	function fuzzymatch(name, names) {
    	    const set = new FuzzySet(names);
    	    const matches = set.get(name);
    	    return matches && matches[0] && matches[0][0] > 0.7 ? matches[0][1] : null;
    	}
    	// adapted from https://github.com/Glench/fuzzyset.js/blob/master/lib/fuzzyset.js
    	// BSD Licensed
    	const GRAM_SIZE_LOWER = 2;
    	const GRAM_SIZE_UPPER = 3;
    	// return an edit distance from 0 to 1
    	function _distance(str1, str2) {
    	    if (str1 === null && str2 === null)
    	        throw 'Trying to compare two null values';
    	    if (str1 === null || str2 === null)
    	        return 0;
    	    str1 = String(str1);
    	    str2 = String(str2);
    	    const distance = levenshtein(str1, str2);
    	    if (str1.length > str2.length) {
    	        return 1 - distance / str1.length;
    	    }
    	    else {
    	        return 1 - distance / str2.length;
    	    }
    	}
    	// helper functions
    	function levenshtein(str1, str2) {
    	    const current = [];
    	    let prev;
    	    let value;
    	    for (let i = 0; i <= str2.length; i++) {
    	        for (let j = 0; j <= str1.length; j++) {
    	            if (i && j) {
    	                if (str1.charAt(j - 1) === str2.charAt(i - 1)) {
    	                    value = prev;
    	                }
    	                else {
    	                    value = Math.min(current[j], current[j - 1], prev) + 1;
    	                }
    	            }
    	            else {
    	                value = i + j;
    	            }
    	            prev = current[j];
    	            current[j] = value;
    	        }
    	    }
    	    return current.pop();
    	}
    	const non_word_regex = /[^\w, ]+/;
    	function iterate_grams(value, gram_size = 2) {
    	    const simplified = '-' + value.toLowerCase().replace(non_word_regex, '') + '-';
    	    const len_diff = gram_size - simplified.length;
    	    const results = [];
    	    if (len_diff > 0) {
    	        for (let i = 0; i < len_diff; ++i) {
    	            value += '-';
    	        }
    	    }
    	    for (let i = 0; i < simplified.length - gram_size + 1; ++i) {
    	        results.push(simplified.slice(i, i + gram_size));
    	    }
    	    return results;
    	}
    	function gram_counter(value, gram_size = 2) {
    	    // return an object where key=gram, value=number of occurrences
    	    const result = {};
    	    const grams = iterate_grams(value, gram_size);
    	    let i = 0;
    	    for (i; i < grams.length; ++i) {
    	        if (grams[i] in result) {
    	            result[grams[i]] += 1;
    	        }
    	        else {
    	            result[grams[i]] = 1;
    	        }
    	    }
    	    return result;
    	}
    	function sort_descending(a, b) {
    	    return b[0] - a[0];
    	}
    	class FuzzySet {
    	    constructor(arr) {
    	        this.exact_set = {};
    	        this.match_dict = {};
    	        this.items = {};
    	        // initialization
    	        for (let i = GRAM_SIZE_LOWER; i < GRAM_SIZE_UPPER + 1; ++i) {
    	            this.items[i] = [];
    	        }
    	        // add all the items to the set
    	        for (let i = 0; i < arr.length; ++i) {
    	            this.add(arr[i]);
    	        }
    	    }
    	    add(value) {
    	        const normalized_value = value.toLowerCase();
    	        if (normalized_value in this.exact_set) {
    	            return false;
    	        }
    	        let i = GRAM_SIZE_LOWER;
    	        for (i; i < GRAM_SIZE_UPPER + 1; ++i) {
    	            this._add(value, i);
    	        }
    	    }
    	    _add(value, gram_size) {
    	        const normalized_value = value.toLowerCase();
    	        const items = this.items[gram_size] || [];
    	        const index = items.length;
    	        items.push(0);
    	        const gram_counts = gram_counter(normalized_value, gram_size);
    	        let sum_of_square_gram_counts = 0;
    	        let gram;
    	        let gram_count;
    	        for (gram in gram_counts) {
    	            gram_count = gram_counts[gram];
    	            sum_of_square_gram_counts += Math.pow(gram_count, 2);
    	            if (gram in this.match_dict) {
    	                this.match_dict[gram].push([index, gram_count]);
    	            }
    	            else {
    	                this.match_dict[gram] = [[index, gram_count]];
    	            }
    	        }
    	        const vector_normal = Math.sqrt(sum_of_square_gram_counts);
    	        items[index] = [vector_normal, normalized_value];
    	        this.items[gram_size] = items;
    	        this.exact_set[normalized_value] = value;
    	    }
    	    get(value) {
    	        const normalized_value = value.toLowerCase();
    	        const result = this.exact_set[normalized_value];
    	        if (result) {
    	            return [[1, result]];
    	        }
    	        let results = [];
    	        // start with high gram size and if there are no results, go to lower gram sizes
    	        for (let gram_size = GRAM_SIZE_UPPER; gram_size >= GRAM_SIZE_LOWER; --gram_size) {
    	            results = this.__get(value, gram_size);
    	            if (results) {
    	                return results;
    	            }
    	        }
    	        return null;
    	    }
    	    __get(value, gram_size) {
    	        const normalized_value = value.toLowerCase();
    	        const matches = {};
    	        const gram_counts = gram_counter(normalized_value, gram_size);
    	        const items = this.items[gram_size];
    	        let sum_of_square_gram_counts = 0;
    	        let gram;
    	        let gram_count;
    	        let i;
    	        let index;
    	        let other_gram_count;
    	        for (gram in gram_counts) {
    	            gram_count = gram_counts[gram];
    	            sum_of_square_gram_counts += Math.pow(gram_count, 2);
    	            if (gram in this.match_dict) {
    	                for (i = 0; i < this.match_dict[gram].length; ++i) {
    	                    index = this.match_dict[gram][i][0];
    	                    other_gram_count = this.match_dict[gram][i][1];
    	                    if (index in matches) {
    	                        matches[index] += gram_count * other_gram_count;
    	                    }
    	                    else {
    	                        matches[index] = gram_count * other_gram_count;
    	                    }
    	                }
    	            }
    	        }
    	        const vector_normal = Math.sqrt(sum_of_square_gram_counts);
    	        let results = [];
    	        let match_score;
    	        // build a results list of [score, str]
    	        for (const match_index in matches) {
    	            match_score = matches[match_index];
    	            results.push([
    	                match_score / (vector_normal * items[match_index][0]),
    	                items[match_index][1],
    	            ]);
    	        }
    	        results.sort(sort_descending);
    	        let new_results = [];
    	        const end_index = Math.min(50, results.length);
    	        // truncate somewhat arbitrarily to 50
    	        for (let i = 0; i < end_index; ++i) {
    	            new_results.push([
    	                _distance(results[i][1], normalized_value),
    	                results[i][1],
    	            ]);
    	        }
    	        results = new_results;
    	        results.sort(sort_descending);
    	        new_results = [];
    	        for (let i = 0; i < results.length; ++i) {
    	            if (results[i][0] == results[0][0]) {
    	                new_results.push([results[i][0], this.exact_set[results[i][1]]]);
    	            }
    	        }
    	        return new_results;
    	    }
    	}

    	function list$1(items, conjunction = 'or') {
    	    if (items.length === 1)
    	        return items[0];
    	    return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
    	}

    	// eslint-disable-next-line no-useless-escape
    	const valid_tag_name = /^\!?[a-zA-Z]{1,}:?[a-zA-Z0-9\-]*/;
    	const meta_tags = new Map([
    	    ['svelte:head', 'Head'],
    	    ['svelte:options', 'Options'],
    	    ['svelte:window', 'Window'],
    	    ['svelte:body', 'Body']
    	]);
    	const valid_meta_tags = Array.from(meta_tags.keys()).concat('svelte:self', 'svelte:component');
    	const specials = new Map([
    	    [
    	        'script',
    	        {
    	            read: read_script,
    	            property: 'js',
    	        },
    	    ],
    	    [
    	        'style',
    	        {
    	            read: read_style,
    	            property: 'css',
    	        },
    	    ],
    	]);
    	const SELF = /^svelte:self(?=[\s/>])/;
    	const COMPONENT = /^svelte:component(?=[\s/>])/;
    	function parent_is_head(stack) {
    	    let i = stack.length;
    	    while (i--) {
    	        const { type } = stack[i];
    	        if (type === 'Head')
    	            return true;
    	        if (type === 'Element' || type === 'InlineComponent')
    	            return false;
    	    }
    	    return false;
    	}
    	function tag(parser) {
    	    const start = parser.index++;
    	    let parent = parser.current();
    	    if (parser.eat('!--')) {
    	        const data = parser.read_until(/-->/);
    	        parser.eat('-->', true, 'comment was left open, expected -->');
    	        parser.current().children.push({
    	            start,
    	            end: parser.index,
    	            type: 'Comment',
    	            data,
    	        });
    	        return;
    	    }
    	    const is_closing_tag = parser.eat('/');
    	    const name = read_tag_name(parser);
    	    if (meta_tags.has(name)) {
    	        const slug = meta_tags.get(name).toLowerCase();
    	        if (is_closing_tag) {
    	            if ((name === 'svelte:window' || name === 'svelte:body') &&
    	                parser.current().children.length) {
    	                parser.error({
    	                    code: `invalid-${slug}-content`,
    	                    message: `<${name}> cannot have children`
    	                }, parser.current().children[0].start);
    	            }
    	        }
    	        else {
    	            if (name in parser.meta_tags) {
    	                parser.error({
    	                    code: `duplicate-${slug}`,
    	                    message: `A component can only have one <${name}> tag`
    	                }, start);
    	            }
    	            if (parser.stack.length > 1) {
    	                parser.error({
    	                    code: `invalid-${slug}-placement`,
    	                    message: `<${name}> tags cannot be inside elements or blocks`
    	                }, start);
    	            }
    	            parser.meta_tags[name] = true;
    	        }
    	    }
    	    const type = meta_tags.has(name)
    	        ? meta_tags.get(name)
    	        : (/[A-Z]/.test(name[0]) || name === 'svelte:self' || name === 'svelte:component') ? 'InlineComponent'
    	            : name === 'title' && parent_is_head(parser.stack) ? 'Title'
    	                : name === 'slot' && !parser.customElement ? 'Slot' : 'Element';
    	    const element = {
    	        start,
    	        end: null,
    	        type,
    	        name,
    	        attributes: [],
    	        children: [],
    	    };
    	    parser.allow_whitespace();
    	    if (is_closing_tag) {
    	        if (is_void(name)) {
    	            parser.error({
    	                code: `invalid-void-content`,
    	                message: `<${name}> is a void element and cannot have children, or a closing tag`
    	            }, start);
    	        }
    	        parser.eat('>', true);
    	        // close any elements that don't have their own closing tags, e.g. <div><p></div>
    	        while (parent.name !== name) {
    	            if (parent.type !== 'Element')
    	                parser.error({
    	                    code: `invalid-closing-tag`,
    	                    message: `</${name}> attempted to close an element that was not open`
    	                }, start);
    	            parent.end = start;
    	            parser.stack.pop();
    	            parent = parser.current();
    	        }
    	        parent.end = parser.index;
    	        parser.stack.pop();
    	        return;
    	    }
    	    else if (closing_tag_omitted(parent.name, name)) {
    	        parent.end = start;
    	        parser.stack.pop();
    	    }
    	    const unique_names = new Set();
    	    let attribute;
    	    while ((attribute = read_attribute(parser, unique_names))) {
    	        element.attributes.push(attribute);
    	        parser.allow_whitespace();
    	    }
    	    if (name === 'svelte:component') {
    	        const index = element.attributes.findIndex(attr => attr.type === 'Attribute' && attr.name === 'this');
    	        if (!~index) {
    	            parser.error({
    	                code: `missing-component-definition`,
    	                message: `<svelte:component> must have a 'this' attribute`
    	            }, start);
    	        }
    	        const definition = element.attributes.splice(index, 1)[0];
    	        if (definition.value === true || definition.value.length !== 1 || definition.value[0].type === 'Text') {
    	            parser.error({
    	                code: `invalid-component-definition`,
    	                message: `invalid component definition`
    	            }, definition.start);
    	        }
    	        element.expression = definition.value[0].expression;
    	    }
    	    // special cases – top-level <script> and <style>
    	    if (specials.has(name) && parser.stack.length === 1) {
    	        const special = specials.get(name);
    	        parser.eat('>', true);
    	        const content = special.read(parser, start, element.attributes);
    	        if (content)
    	            parser[special.property].push(content);
    	        return;
    	    }
    	    parser.current().children.push(element);
    	    const self_closing = parser.eat('/') || is_void(name);
    	    parser.eat('>', true);
    	    if (self_closing) {
    	        // don't push self-closing elements onto the stack
    	        element.end = parser.index;
    	    }
    	    else if (name === 'textarea') {
    	        // special case
    	        element.children = read_sequence(parser, () => parser.template.slice(parser.index, parser.index + 11) === '</textarea>');
    	        parser.read(/<\/textarea>/);
    	        element.end = parser.index;
    	    }
    	    else if (name === 'script') {
    	        // special case
    	        const start = parser.index;
    	        const data = parser.read_until(/<\/script>/);
    	        const end = parser.index;
    	        element.children.push({ start, end, type: 'Text', data });
    	        parser.eat('</script>', true);
    	        element.end = parser.index;
    	    }
    	    else if (name === 'style') {
    	        // special case
    	        const start = parser.index;
    	        const data = parser.read_until(/<\/style>/);
    	        const end = parser.index;
    	        element.children.push({ start, end, type: 'Text', data });
    	        parser.eat('</style>', true);
    	    }
    	    else {
    	        parser.stack.push(element);
    	    }
    	}
    	function read_tag_name(parser) {
    	    const start = parser.index;
    	    if (parser.read(SELF)) {
    	        // check we're inside a block, otherwise this
    	        // will cause infinite recursion
    	        let i = parser.stack.length;
    	        let legal = false;
    	        while (i--) {
    	            const fragment = parser.stack[i];
    	            if (fragment.type === 'IfBlock' || fragment.type === 'EachBlock') {
    	                legal = true;
    	                break;
    	            }
    	        }
    	        if (!legal) {
    	            parser.error({
    	                code: `invalid-self-placement`,
    	                message: `<svelte:self> components can only exist inside if-blocks or each-blocks`
    	            }, start);
    	        }
    	        return 'svelte:self';
    	    }
    	    if (parser.read(COMPONENT))
    	        return 'svelte:component';
    	    const name = parser.read_until(/(\s|\/|>)/);
    	    if (meta_tags.has(name))
    	        return name;
    	    if (name.startsWith('svelte:')) {
    	        const match = fuzzymatch(name.slice(7), valid_meta_tags);
    	        let message = `Valid <svelte:...> tag names are ${list$1(valid_meta_tags)}`;
    	        if (match)
    	            message += ` (did you mean '${match}'?)`;
    	        parser.error({
    	            code: 'invalid-tag-name',
    	            message
    	        }, start);
    	    }
    	    if (!valid_tag_name.test(name)) {
    	        parser.error({
    	            code: `invalid-tag-name`,
    	            message: `Expected valid tag name`
    	        }, start);
    	    }
    	    return name;
    	}
    	function read_attribute(parser, unique_names) {
    	    const start = parser.index;
    	    if (parser.eat('{')) {
    	        parser.allow_whitespace();
    	        if (parser.eat('...')) {
    	            const expression = read_expression(parser);
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	            return {
    	                start,
    	                end: parser.index,
    	                type: 'Spread',
    	                expression
    	            };
    	        }
    	        else {
    	            const value_start = parser.index;
    	            const name = parser.read_identifier();
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	            return {
    	                start,
    	                end: parser.index,
    	                type: 'Attribute',
    	                name,
    	                value: [{
    	                        start: value_start,
    	                        end: value_start + name.length,
    	                        type: 'AttributeShorthand',
    	                        expression: {
    	                            start: value_start,
    	                            end: value_start + name.length,
    	                            type: 'Identifier',
    	                            name
    	                        }
    	                    }]
    	            };
    	        }
    	    }
    	    // eslint-disable-next-line no-useless-escape
    	    const name = parser.read_until(/[\s=\/>"']/);
    	    if (!name)
    	        return null;
    	    let end = parser.index;
    	    parser.allow_whitespace();
    	    const colon_index = name.indexOf(':');
    	    const type = colon_index !== -1 && get_directive_type(name.slice(0, colon_index));
    	    if (unique_names.has(name)) {
    	        parser.error({
    	            code: `duplicate-attribute`,
    	            message: 'Attributes need to be unique'
    	        }, start);
    	    }
    	    if (type !== "EventHandler") {
    	        unique_names.add(name);
    	    }
    	    let value = true;
    	    if (parser.eat('=')) {
    	        parser.allow_whitespace();
    	        value = read_attribute_value(parser);
    	        end = parser.index;
    	    }
    	    else if (parser.match_regex(/["']/)) {
    	        parser.error({
    	            code: `unexpected-token`,
    	            message: `Expected =`
    	        }, parser.index);
    	    }
    	    if (type) {
    	        const [directive_name, ...modifiers] = name.slice(colon_index + 1).split('|');
    	        if (type === 'Ref') {
    	            parser.error({
    	                code: `invalid-ref-directive`,
    	                message: `The ref directive is no longer supported — use \`bind:this={${directive_name}}\` instead`
    	            }, start);
    	        }
    	        if (value[0]) {
    	            if (value.length > 1 || value[0].type === 'Text') {
    	                parser.error({
    	                    code: `invalid-directive-value`,
    	                    message: `Directive value must be a JavaScript expression enclosed in curly braces`
    	                }, value[0].start);
    	            }
    	        }
    	        const directive = {
    	            start,
    	            end,
    	            type,
    	            name: directive_name,
    	            modifiers,
    	            expression: (value[0] && value[0].expression) || null
    	        };
    	        if (type === 'Transition') {
    	            const direction = name.slice(0, colon_index);
    	            directive.intro = direction === 'in' || direction === 'transition';
    	            directive.outro = direction === 'out' || direction === 'transition';
    	        }
    	        if (!directive.expression && (type === 'Binding' || type === 'Class')) {
    	            directive.expression = {
    	                start: directive.start + colon_index + 1,
    	                end: directive.end,
    	                type: 'Identifier',
    	                name: directive.name
    	            };
    	        }
    	        return directive;
    	    }
    	    return {
    	        start,
    	        end,
    	        type: 'Attribute',
    	        name,
    	        value,
    	    };
    	}
    	function get_directive_type(name) {
    	    if (name === 'use')
    	        return 'Action';
    	    if (name === 'animate')
    	        return 'Animation';
    	    if (name === 'bind')
    	        return 'Binding';
    	    if (name === 'class')
    	        return 'Class';
    	    if (name === 'on')
    	        return 'EventHandler';
    	    if (name === 'let')
    	        return 'Let';
    	    if (name === 'ref')
    	        return 'Ref';
    	    if (name === 'in' || name === 'out' || name === 'transition')
    	        return 'Transition';
    	}
    	function read_attribute_value(parser) {
    	    const quote_mark = parser.eat(`'`) ? `'` : parser.eat(`"`) ? `"` : null;
    	    const regex = (quote_mark === `'` ? /'/ :
    	        quote_mark === `"` ? /"/ :
    	            /(\/>|[\s"'=<>`])/);
    	    const value = read_sequence(parser, () => !!parser.match_regex(regex));
    	    if (quote_mark)
    	        parser.index += 1;
    	    return value;
    	}
    	function read_sequence(parser, done) {
    	    let current_chunk = {
    	        start: parser.index,
    	        end: null,
    	        type: 'Text',
    	        raw: '',
    	        data: null
    	    };
    	    function flush() {
    	        if (current_chunk.raw) {
    	            current_chunk.data = decode_character_references(current_chunk.raw);
    	            current_chunk.end = parser.index;
    	            chunks.push(current_chunk);
    	        }
    	    }
    	    const chunks = [];
    	    while (parser.index < parser.template.length) {
    	        const index = parser.index;
    	        if (done()) {
    	            flush();
    	            return chunks;
    	        }
    	        else if (parser.eat('{')) {
    	            flush();
    	            parser.allow_whitespace();
    	            const expression = read_expression(parser);
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	            chunks.push({
    	                start: index,
    	                end: parser.index,
    	                type: 'MustacheTag',
    	                expression,
    	            });
    	            current_chunk = {
    	                start: parser.index,
    	                end: null,
    	                type: 'Text',
    	                raw: '',
    	                data: null
    	            };
    	        }
    	        else {
    	            current_chunk.raw += parser.template[parser.index++];
    	        }
    	    }
    	    parser.error({
    	        code: `unexpected-eof`,
    	        message: `Unexpected end of input`
    	    });
    	}

    	function error_on_assignment_pattern(parser) {
    	    if (parser.eat('=')) {
    	        parser.error({
    	            code: 'invalid-assignment-pattern',
    	            message: 'Assignment patterns are not supported'
    	        }, parser.index - 1);
    	    }
    	}
    	function error_on_rest_pattern_not_last(parser) {
    	    parser.error({
    	        code: 'rest-pattern-not-last',
    	        message: 'Rest destructuring expected to be last'
    	    }, parser.index);
    	}
    	function read_context(parser) {
    	    const context = {
    	        start: parser.index,
    	        end: null,
    	        type: null
    	    };
    	    if (parser.eat('[')) {
    	        context.type = 'ArrayPattern';
    	        context.elements = [];
    	        do {
    	            parser.allow_whitespace();
    	            const lastContext = context.elements[context.elements.length - 1];
    	            if (lastContext && lastContext.type === 'RestIdentifier') {
    	                error_on_rest_pattern_not_last(parser);
    	            }
    	            if (parser.template[parser.index] === ',') {
    	                context.elements.push(null);
    	            }
    	            else {
    	                context.elements.push(read_context(parser));
    	                parser.allow_whitespace();
    	            }
    	        } while (parser.eat(','));
    	        error_on_assignment_pattern(parser);
    	        parser.eat(']', true);
    	        context.end = parser.index;
    	    }
    	    else if (parser.eat('{')) {
    	        context.type = 'ObjectPattern';
    	        context.properties = [];
    	        do {
    	            parser.allow_whitespace();
    	            if (parser.eat('...')) {
    	                parser.allow_whitespace();
    	                const start = parser.index;
    	                const name = parser.read_identifier();
    	                const key = {
    	                    start,
    	                    end: parser.index,
    	                    type: 'Identifier',
    	                    name
    	                };
    	                const property = {
    	                    start,
    	                    end: parser.index,
    	                    type: 'Property',
    	                    kind: 'rest',
    	                    shorthand: true,
    	                    key,
    	                    value: key
    	                };
    	                context.properties.push(property);
    	                parser.allow_whitespace();
    	                if (parser.eat(',')) {
    	                    parser.error({
    	                        code: `comma-after-rest`,
    	                        message: `Comma is not permitted after the rest element`
    	                    }, parser.index - 1);
    	                }
    	                break;
    	            }
    	            const start = parser.index;
    	            const name = parser.read_identifier();
    	            const key = {
    	                start,
    	                end: parser.index,
    	                type: 'Identifier',
    	                name
    	            };
    	            parser.allow_whitespace();
    	            const value = parser.eat(':')
    	                ? (parser.allow_whitespace(), read_context(parser))
    	                : key;
    	            const property = {
    	                start,
    	                end: value.end,
    	                type: 'Property',
    	                kind: 'init',
    	                shorthand: value.type === 'Identifier' && value.name === name,
    	                key,
    	                value
    	            };
    	            context.properties.push(property);
    	            parser.allow_whitespace();
    	        } while (parser.eat(','));
    	        error_on_assignment_pattern(parser);
    	        parser.eat('}', true);
    	        context.end = parser.index;
    	    }
    	    else if (parser.eat('...')) {
    	        const name = parser.read_identifier();
    	        if (name) {
    	            context.type = 'RestIdentifier';
    	            context.end = parser.index;
    	            context.name = name;
    	        }
    	        else {
    	            parser.error({
    	                code: 'invalid-context',
    	                message: 'Expected a rest pattern'
    	            });
    	        }
    	    }
    	    else {
    	        const name = parser.read_identifier();
    	        if (name) {
    	            context.type = 'Identifier';
    	            context.end = parser.index;
    	            context.name = name;
    	        }
    	        else {
    	            parser.error({
    	                code: 'invalid-context',
    	                message: 'Expected a name, array pattern or object pattern'
    	            });
    	        }
    	        error_on_assignment_pattern(parser);
    	    }
    	    return context;
    	}

    	function trim_start(str) {
    	    let i = 0;
    	    while (whitespace.test(str[i]))
    	        i += 1;
    	    return str.slice(i);
    	}
    	function trim_end(str) {
    	    let i = str.length;
    	    while (whitespace.test(str[i - 1]))
    	        i -= 1;
    	    return str.slice(0, i);
    	}

    	function trim_whitespace(block, trim_before, trim_after) {
    	    if (!block.children || block.children.length === 0)
    	        return; // AwaitBlock
    	    const first_child = block.children[0];
    	    const last_child = block.children[block.children.length - 1];
    	    if (first_child.type === 'Text' && trim_before) {
    	        first_child.data = trim_start(first_child.data);
    	        if (!first_child.data)
    	            block.children.shift();
    	    }
    	    if (last_child.type === 'Text' && trim_after) {
    	        last_child.data = trim_end(last_child.data);
    	        if (!last_child.data)
    	            block.children.pop();
    	    }
    	    if (block.else) {
    	        trim_whitespace(block.else, trim_before, trim_after);
    	    }
    	    if (first_child.elseif) {
    	        trim_whitespace(first_child, trim_before, trim_after);
    	    }
    	}
    	function mustache(parser) {
    	    const start = parser.index;
    	    parser.index += 1;
    	    parser.allow_whitespace();
    	    // {/if}, {/each} or {/await}
    	    if (parser.eat('/')) {
    	        let block = parser.current();
    	        let expected;
    	        if (closing_tag_omitted(block.name)) {
    	            block.end = start;
    	            parser.stack.pop();
    	            block = parser.current();
    	        }
    	        if (block.type === 'ElseBlock' || block.type === 'PendingBlock' || block.type === 'ThenBlock' || block.type === 'CatchBlock') {
    	            block.end = start;
    	            parser.stack.pop();
    	            block = parser.current();
    	            expected = 'await';
    	        }
    	        if (block.type === 'IfBlock') {
    	            expected = 'if';
    	        }
    	        else if (block.type === 'EachBlock') {
    	            expected = 'each';
    	        }
    	        else if (block.type === 'AwaitBlock') {
    	            expected = 'await';
    	        }
    	        else {
    	            parser.error({
    	                code: `unexpected-block-close`,
    	                message: `Unexpected block closing tag`
    	            });
    	        }
    	        parser.eat(expected, true);
    	        parser.allow_whitespace();
    	        parser.eat('}', true);
    	        while (block.elseif) {
    	            block.end = parser.index;
    	            parser.stack.pop();
    	            block = parser.current();
    	            if (block.else) {
    	                block.else.end = start;
    	            }
    	        }
    	        // strip leading/trailing whitespace as necessary
    	        const char_before = parser.template[block.start - 1];
    	        const char_after = parser.template[parser.index];
    	        const trim_before = !char_before || whitespace.test(char_before);
    	        const trim_after = !char_after || whitespace.test(char_after);
    	        trim_whitespace(block, trim_before, trim_after);
    	        block.end = parser.index;
    	        parser.stack.pop();
    	    }
    	    else if (parser.eat(':else')) {
    	        if (parser.eat('if')) {
    	            parser.error({
    	                code: 'invalid-elseif',
    	                message: `'elseif' should be 'else if'`
    	            });
    	        }
    	        parser.allow_whitespace();
    	        // :else if
    	        if (parser.eat('if')) {
    	            const block = parser.current();
    	            if (block.type !== 'IfBlock')
    	                parser.error({
    	                    code: `invalid-elseif-placement`,
    	                    message: 'Cannot have an {:else if ...} block outside an {#if ...} block'
    	                });
    	            parser.require_whitespace();
    	            const expression = read_expression(parser);
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	            block.else = {
    	                start: parser.index,
    	                end: null,
    	                type: 'ElseBlock',
    	                children: [
    	                    {
    	                        start: parser.index,
    	                        end: null,
    	                        type: 'IfBlock',
    	                        elseif: true,
    	                        expression,
    	                        children: [],
    	                    },
    	                ],
    	            };
    	            parser.stack.push(block.else.children[0]);
    	        }
    	        // :else
    	        else {
    	            const block = parser.current();
    	            if (block.type !== 'IfBlock' && block.type !== 'EachBlock') {
    	                parser.error({
    	                    code: `invalid-else-placement`,
    	                    message: 'Cannot have an {:else} block outside an {#if ...} or {#each ...} block'
    	                });
    	            }
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	            block.else = {
    	                start: parser.index,
    	                end: null,
    	                type: 'ElseBlock',
    	                children: [],
    	            };
    	            parser.stack.push(block.else);
    	        }
    	    }
    	    else if (parser.match(':then') || parser.match(':catch')) {
    	        const block = parser.current();
    	        const is_then = parser.eat(':then') || !parser.eat(':catch');
    	        if (is_then) {
    	            if (block.type !== 'PendingBlock') {
    	                parser.error({
    	                    code: `invalid-then-placement`,
    	                    message: 'Cannot have an {:then} block outside an {#await ...} block'
    	                });
    	            }
    	        }
    	        else {
    	            if (block.type !== 'ThenBlock' && block.type !== 'PendingBlock') {
    	                parser.error({
    	                    code: `invalid-catch-placement`,
    	                    message: 'Cannot have an {:catch} block outside an {#await ...} block'
    	                });
    	            }
    	        }
    	        block.end = start;
    	        parser.stack.pop();
    	        const await_block = parser.current();
    	        if (!parser.eat('}')) {
    	            parser.require_whitespace();
    	            await_block[is_then ? 'value' : 'error'] = parser.read_identifier();
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	        }
    	        const new_block = {
    	            start,
    	            end: null,
    	            type: is_then ? 'ThenBlock' : 'CatchBlock',
    	            children: [],
    	            skip: false
    	        };
    	        await_block[is_then ? 'then' : 'catch'] = new_block;
    	        parser.stack.push(new_block);
    	    }
    	    else if (parser.eat('#')) {
    	        // {#if foo}, {#each foo} or {#await foo}
    	        let type;
    	        if (parser.eat('if')) {
    	            type = 'IfBlock';
    	        }
    	        else if (parser.eat('each')) {
    	            type = 'EachBlock';
    	        }
    	        else if (parser.eat('await')) {
    	            type = 'AwaitBlock';
    	        }
    	        else {
    	            parser.error({
    	                code: `expected-block-type`,
    	                message: `Expected if, each or await`
    	            });
    	        }
    	        parser.require_whitespace();
    	        const expression = read_expression(parser);
    	        const block = type === 'AwaitBlock' ?
    	            {
    	                start,
    	                end: null,
    	                type,
    	                expression,
    	                value: null,
    	                error: null,
    	                pending: {
    	                    start: null,
    	                    end: null,
    	                    type: 'PendingBlock',
    	                    children: [],
    	                    skip: true
    	                },
    	                then: {
    	                    start: null,
    	                    end: null,
    	                    type: 'ThenBlock',
    	                    children: [],
    	                    skip: true
    	                },
    	                catch: {
    	                    start: null,
    	                    end: null,
    	                    type: 'CatchBlock',
    	                    children: [],
    	                    skip: true
    	                },
    	            } :
    	            {
    	                start,
    	                end: null,
    	                type,
    	                expression,
    	                children: [],
    	            };
    	        parser.allow_whitespace();
    	        // {#each} blocks must declare a context – {#each list as item}
    	        if (type === 'EachBlock') {
    	            parser.eat('as', true);
    	            parser.require_whitespace();
    	            block.context = read_context(parser);
    	            parser.allow_whitespace();
    	            if (parser.eat(',')) {
    	                parser.allow_whitespace();
    	                block.index = parser.read_identifier();
    	                if (!block.index)
    	                    parser.error({
    	                        code: `expected-name`,
    	                        message: `Expected name`
    	                    });
    	                parser.allow_whitespace();
    	            }
    	            if (parser.eat('(')) {
    	                parser.allow_whitespace();
    	                block.key = read_expression(parser);
    	                parser.allow_whitespace();
    	                parser.eat(')', true);
    	                parser.allow_whitespace();
    	            }
    	        }
    	        const await_block_shorthand = type === 'AwaitBlock' && parser.eat('then');
    	        if (await_block_shorthand) {
    	            parser.require_whitespace();
    	            block.value = parser.read_identifier();
    	            parser.allow_whitespace();
    	        }
    	        parser.eat('}', true);
    	        parser.current().children.push(block);
    	        parser.stack.push(block);
    	        if (type === 'AwaitBlock') {
    	            let child_block;
    	            if (await_block_shorthand) {
    	                block.then.skip = false;
    	                child_block = block.then;
    	            }
    	            else {
    	                block.pending.skip = false;
    	                child_block = block.pending;
    	            }
    	            child_block.start = parser.index;
    	            parser.stack.push(child_block);
    	        }
    	    }
    	    else if (parser.eat('@html')) {
    	        // {@html content} tag
    	        parser.require_whitespace();
    	        const expression = read_expression(parser);
    	        parser.allow_whitespace();
    	        parser.eat('}', true);
    	        parser.current().children.push({
    	            start,
    	            end: parser.index,
    	            type: 'RawMustacheTag',
    	            expression,
    	        });
    	    }
    	    else if (parser.eat('@debug')) {
    	        let identifiers;
    	        // Implies {@debug} which indicates "debug all"
    	        if (parser.read(/\s*}/)) {
    	            identifiers = [];
    	        }
    	        else {
    	            const expression = read_expression(parser);
    	            identifiers = expression.type === 'SequenceExpression'
    	                ? expression.expressions
    	                : [expression];
    	            identifiers.forEach(node => {
    	                if (node.type !== 'Identifier') {
    	                    parser.error({
    	                        code: 'invalid-debug-args',
    	                        message: '{@debug ...} arguments must be identifiers, not arbitrary expressions'
    	                    }, node.start);
    	                }
    	            });
    	            parser.allow_whitespace();
    	            parser.eat('}', true);
    	        }
    	        parser.current().children.push({
    	            start,
    	            end: parser.index,
    	            type: 'DebugTag',
    	            identifiers
    	        });
    	    }
    	    else {
    	        const expression = read_expression(parser);
    	        parser.allow_whitespace();
    	        parser.eat('}', true);
    	        parser.current().children.push({
    	            start,
    	            end: parser.index,
    	            type: 'MustacheTag',
    	            expression,
    	        });
    	    }
    	}

    	function text(parser) {
    	    const start = parser.index;
    	    let data = '';
    	    while (parser.index < parser.template.length &&
    	        !parser.match('<') &&
    	        !parser.match('{')) {
    	        data += parser.template[parser.index++];
    	    }
    	    const node = {
    	        start,
    	        end: parser.index,
    	        type: 'Text',
    	        raw: data,
    	        data: decode_character_references(data),
    	    };
    	    parser.current().children.push(node);
    	}

    	function fragment(parser) {
    	    if (parser.match('<')) {
    	        return tag;
    	    }
    	    if (parser.match('{')) {
    	        return mustache;
    	    }
    	    return text;
    	}

    	function getLocator(source, options) {
    	    if (options === void 0) { options = {}; }
    	    var offsetLine = options.offsetLine || 0;
    	    var offsetColumn = options.offsetColumn || 0;
    	    var originalLines = source.split('\n');
    	    var start = 0;
    	    var lineRanges = originalLines.map(function (line, i) {
    	        var end = start + line.length + 1;
    	        var range = { start: start, end: end, line: i };
    	        start = end;
    	        return range;
    	    });
    	    var i = 0;
    	    function rangeContains(range, index) {
    	        return range.start <= index && index < range.end;
    	    }
    	    function getLocation(range, index) {
    	        return { line: offsetLine + range.line, column: offsetColumn + index - range.start, character: index };
    	    }
    	    function locate(search, startIndex) {
    	        if (typeof search === 'string') {
    	            search = source.indexOf(search, startIndex || 0);
    	        }
    	        var range = lineRanges[i];
    	        var d = search >= range.end ? 1 : -1;
    	        while (range) {
    	            if (rangeContains(range, search))
    	                return getLocation(range, search);
    	            i += d;
    	            range = lineRanges[i];
    	        }
    	    }
    	    return locate;
    	}
    	function locate(source, search, options) {
    	    if (typeof options === 'number') {
    	        throw new Error('locate takes a { startIndex, offsetLine, offsetColumn } object as the third argument');
    	    }
    	    return getLocator(source, options)(search, options && options.startIndex);
    	}

    	function tabs_to_spaces(str) {
    	    return str.replace(/^\t+/, match => match.split('\t').join('  '));
    	}
    	function get_code_frame(source, line, column) {
    	    const lines = source.split('\n');
    	    const frame_start = Math.max(0, line - 2);
    	    const frame_end = Math.min(line + 3, lines.length);
    	    const digits = String(frame_end + 1).length;
    	    return lines
    	        .slice(frame_start, frame_end)
    	        .map((str, i) => {
    	        const isErrorLine = frame_start + i === line;
    	        const line_num = String(i + frame_start + 1).padStart(digits, ' ');
    	        if (isErrorLine) {
    	            const indicator = ' '.repeat(digits + 2 + tabs_to_spaces(str.slice(0, column)).length) + '^';
    	            return `${line_num}: ${tabs_to_spaces(str)}\n${indicator}`;
    	        }
    	        return `${line_num}: ${tabs_to_spaces(str)}`;
    	    })
    	        .join('\n');
    	}

    	class CompileError extends Error {
    	    toString() {
    	        return `${this.message} (${this.start.line}:${this.start.column})\n${this.frame}`;
    	    }
    	}
    	function error$1(message, props) {
    	    const error = new CompileError(message);
    	    error.name = props.name;
    	    const start = locate(props.source, props.start, { offsetLine: 1 });
    	    const end = locate(props.source, props.end || props.start, { offsetLine: 1 });
    	    error.code = props.code;
    	    error.start = start;
    	    error.end = end;
    	    error.pos = props.start;
    	    error.filename = props.filename;
    	    error.frame = get_code_frame(props.source, start.line - 1, start.column);
    	    throw error;
    	}

    	class Parser$2 {
    	    constructor(template, options) {
    	        this.index = 0;
    	        this.stack = [];
    	        this.css = [];
    	        this.js = [];
    	        this.meta_tags = {};
    	        if (typeof template !== 'string') {
    	            throw new TypeError('Template must be a string');
    	        }
    	        this.template = template.replace(/\s+$/, '');
    	        this.filename = options.filename;
    	        this.customElement = options.customElement;
    	        this.html = {
    	            start: null,
    	            end: null,
    	            type: 'Fragment',
    	            children: [],
    	        };
    	        this.stack.push(this.html);
    	        let state = fragment;
    	        while (this.index < this.template.length) {
    	            state = state(this) || fragment;
    	        }
    	        if (this.stack.length > 1) {
    	            const current = this.current();
    	            const type = current.type === 'Element' ? `<${current.name}>` : 'Block';
    	            const slug = current.type === 'Element' ? 'element' : 'block';
    	            this.error({
    	                code: `unclosed-${slug}`,
    	                message: `${type} was left open`
    	            }, current.start);
    	        }
    	        if (state !== fragment) {
    	            this.error({
    	                code: `unexpected-eof`,
    	                message: 'Unexpected end of input'
    	            });
    	        }
    	        if (this.html.children.length) {
    	            let start = this.html.children[0].start;
    	            while (whitespace.test(template[start]))
    	                start += 1;
    	            let end = this.html.children[this.html.children.length - 1].end;
    	            while (whitespace.test(template[end - 1]))
    	                end -= 1;
    	            this.html.start = start;
    	            this.html.end = end;
    	        }
    	        else {
    	            this.html.start = this.html.end = null;
    	        }
    	    }
    	    current() {
    	        return this.stack[this.stack.length - 1];
    	    }
    	    acorn_error(err) {
    	        this.error({
    	            code: `parse-error`,
    	            message: err.message.replace(/ \(\d+:\d+\)$/, '')
    	        }, err.pos);
    	    }
    	    error({ code, message }, index = this.index) {
    	        error$1(message, {
    	            name: 'ParseError',
    	            code,
    	            source: this.template,
    	            start: index,
    	            filename: this.filename
    	        });
    	    }
    	    eat(str, required, message) {
    	        if (this.match(str)) {
    	            this.index += str.length;
    	            return true;
    	        }
    	        if (required) {
    	            this.error({
    	                code: `unexpected-${this.index === this.template.length ? 'eof' : 'token'}`,
    	                message: message || `Expected ${str}`
    	            });
    	        }
    	        return false;
    	    }
    	    match(str) {
    	        return this.template.slice(this.index, this.index + str.length) === str;
    	    }
    	    match_regex(pattern) {
    	        const match = pattern.exec(this.template.slice(this.index));
    	        if (!match || match.index !== 0)
    	            return null;
    	        return match[0];
    	    }
    	    allow_whitespace() {
    	        while (this.index < this.template.length &&
    	            whitespace.test(this.template[this.index])) {
    	            this.index++;
    	        }
    	    }
    	    read(pattern) {
    	        const result = this.match_regex(pattern);
    	        if (result)
    	            this.index += result.length;
    	        return result;
    	    }
    	    read_identifier() {
    	        const start = this.index;
    	        let i = this.index;
    	        const code = full_char_code_at(this.template, i);
    	        if (!isIdentifierStart(code, true))
    	            return null;
    	        i += code <= 0xffff ? 1 : 2;
    	        while (i < this.template.length) {
    	            const code = full_char_code_at(this.template, i);
    	            if (!isIdentifierChar(code, true))
    	                break;
    	            i += code <= 0xffff ? 1 : 2;
    	        }
    	        const identifier = this.template.slice(this.index, this.index = i);
    	        if (reserved.has(identifier)) {
    	            this.error({
    	                code: `unexpected-reserved-word`,
    	                message: `'${identifier}' is a reserved word in JavaScript and cannot be used here`
    	            }, start);
    	        }
    	        return identifier;
    	    }
    	    read_until(pattern) {
    	        if (this.index >= this.template.length)
    	            this.error({
    	                code: `unexpected-eof`,
    	                message: 'Unexpected end of input'
    	            });
    	        const start = this.index;
    	        const match = pattern.exec(this.template.slice(start));
    	        if (match) {
    	            this.index = start + match.index;
    	            return this.template.slice(start, this.index);
    	        }
    	        this.index = this.template.length;
    	        return this.template.slice(start);
    	    }
    	    require_whitespace() {
    	        if (!whitespace.test(this.template[this.index])) {
    	            this.error({
    	                code: `missing-whitespace`,
    	                message: `Expected whitespace`
    	            });
    	        }
    	        this.allow_whitespace();
    	    }
    	}
    	function parse$2(template, options = {}) {
    	    const parser = new Parser$2(template, options);
    	    // TODO we may want to allow multiple <style> tags —
    	    // one scoped, one global. for now, only allow one
    	    if (parser.css.length > 1) {
    	        parser.error({
    	            code: 'duplicate-style',
    	            message: 'You can only have one top-level <style> tag per component'
    	        }, parser.css[1].start);
    	    }
    	    const instance_scripts = parser.js.filter(script => script.context === 'default');
    	    const module_scripts = parser.js.filter(script => script.context === 'module');
    	    if (instance_scripts.length > 1) {
    	        parser.error({
    	            code: `invalid-script`,
    	            message: `A component can only have one instance-level <script> element`
    	        }, instance_scripts[1].start);
    	    }
    	    if (module_scripts.length > 1) {
    	        parser.error({
    	            code: `invalid-script`,
    	            message: `A component can only have one <script context="module"> element`
    	        }, module_scripts[1].start);
    	    }
    	    return {
    	        html: parser.html,
    	        css: parser.css[0],
    	        instance: instance_scripts[0],
    	        module: module_scripts[0]
    	    };
    	}

    	function isReference(node, parent) {
    	    if (node.type === 'MemberExpression') {
    	        return !node.computed && isReference(node.object, node);
    	    }
    	    if (node.type === 'Identifier') {
    	        if (!parent)
    	            return true;
    	        switch (parent.type) {
    	            // disregard `bar` in `foo.bar`
    	            case 'MemberExpression': return parent.computed || node === parent.object;
    	            // disregard the `foo` in `class {foo(){}}` but keep it in `class {[foo](){}}`
    	            case 'MethodDefinition': return parent.computed;
    	            // disregard the `bar` in `{ bar: foo }`, but keep it in `{ [bar]: foo }`
    	            case 'Property': return parent.computed || node === parent.value;
    	            // disregard the `bar` in `export { foo as bar }` or
    	            // the foo in `import { foo as bar }`
    	            case 'ExportSpecifier':
    	            case 'ImportSpecifier': return node === parent.local;
    	            // disregard the `foo` in `foo: while (...) { ... break foo; ... continue foo;}`
    	            case 'LabeledStatement':
    	            case 'BreakStatement':
    	            case 'ContinueStatement': return false;
    	            default: return true;
    	        }
    	    }
    	    return false;
    	}

    	function analyze(expression) {
    		const map = new WeakMap();

    		let scope = new Scope$1(null, false);

    		walk(expression, {
    			enter(node, parent) {
    				if (node.type === 'ImportDeclaration') {
    					node.specifiers.forEach((specifier) => {
    						scope.declarations.set(specifier.local.name, specifier);
    					});
    				} else if (/(Function(Declaration|Expression)|ArrowFunctionExpression)/.test(node.type)) {
    					if (node.type === 'FunctionDeclaration') {
    						scope.declarations.set(node.id.name, node);
    						map.set(node, scope = new Scope$1(scope, false));
    					} else {
    						map.set(node, scope = new Scope$1(scope, false));
    						if (node.type === 'FunctionExpression' && node.id) scope.declarations.set(node.id.name, node);
    					}

    					node.params.forEach((param) => {
    						extract_names(param).forEach(name => {
    							scope.declarations.set(name, node);
    						});
    					});
    				} else if (/For(?:In|Of)?Statement/.test(node.type)) {
    					map.set(node, scope = new Scope$1(scope, true));
    				} else if (node.type === 'BlockStatement') {
    					map.set(node, scope = new Scope$1(scope, true));
    				} else if (/(Class|Variable)Declaration/.test(node.type)) {
    					scope.add_declaration(node);
    				} else if (node.type === 'CatchClause') {
    					map.set(node, scope = new Scope$1(scope, true));

    					if (node.param) {
    						extract_names(node.param).forEach(name => {
    							scope.declarations.set(name, node.param);
    						});
    					}
    				}
    			},

    			leave(node) {
    				if (map.has(node)) {
    					scope = scope.parent;
    				}
    			}
    		});

    		const globals = new Map();

    		walk(expression, {
    			enter(node, parent) {
    				if (map.has(node)) scope = map.get(node);

    				if (node.type === 'Identifier' && isReference(node, parent)) {
    					const owner = scope.find_owner(node.name);
    					if (!owner) globals.set(node.name, node);

    					add_reference(scope, node.name);
    				}
    			},
    			leave(node) {
    				if (map.has(node)) {
    					scope = scope.parent;
    				}
    			}
    		});

    		return { map, scope, globals };
    	}

    	function add_reference(scope, name) {
    		scope.references.add(name);
    		if (scope.parent) add_reference(scope.parent, name);
    	}

    	class Scope$1 {
    		
    		
    		__init() {this.declarations = new Map();}
    		__init2() {this.initialised_declarations = new Set();}
    		__init3() {this.references = new Set();}

    		constructor(parent, block) {Scope$1.prototype.__init.call(this);Scope$1.prototype.__init2.call(this);Scope$1.prototype.__init3.call(this);
    			this.parent = parent;
    			this.block = block;
    		}


    		add_declaration(node) {
    			if (node.type === 'VariableDeclaration') {
    				if (node.kind === 'var' && this.block && this.parent) {
    					this.parent.add_declaration(node);
    				} else if (node.type === 'VariableDeclaration') {
    					node.declarations.forEach((declarator) => {
    						extract_names(declarator.id).forEach(name => {
    							this.declarations.set(name, node);
    							if (declarator.init) this.initialised_declarations.add(name);
    						});
    					});
    				}
    			} else {
    				this.declarations.set(node.id.name, node);
    			}
    		}

    		find_owner(name) {
    			if (this.declarations.has(name)) return this;
    			return this.parent && this.parent.find_owner(name);
    		}

    		has(name) {
    			return (
    				this.declarations.has(name) || (this.parent && this.parent.has(name))
    			);
    		}
    	}

    	function extract_names(param) {
    		return extract_identifiers(param).map(node => node.name);
    	}

    	function extract_identifiers(param) {
    		const nodes = [];
    		extractors[param.type] && extractors[param.type](nodes, param);
    		return nodes;
    	}

    	const extractors = {
    		Identifier(nodes, param) {
    			nodes.push(param);
    		},

    		MemberExpression(nodes, param) {
    			let object = param;
    			while (object.type === 'MemberExpression') object = object.object;
    			nodes.push(object);
    		},

    		ObjectPattern(nodes, param) {
    			param.properties.forEach((prop) => {
    				if (prop.type === 'RestElement') {
    					nodes.push(prop.argument);
    				} else {
    					extractors[prop.value.type](nodes, prop.value);
    				}
    			});
    		},

    		ArrayPattern(nodes, param) {
    			param.elements.forEach((element) => {
    				if (element) extractors[element.type](nodes, element);
    			});
    		},

    		RestElement(nodes, param) {
    			extractors[param.argument.type](nodes, param.argument);
    		},

    		AssignmentPattern(nodes, param) {
    			extractors[param.left.type](nodes, param.left);
    		}
    	};

    	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    	function encode(decoded) {
    	    var sourceFileIndex = 0; // second field
    	    var sourceCodeLine = 0; // third field
    	    var sourceCodeColumn = 0; // fourth field
    	    var nameIndex = 0; // fifth field
    	    var mappings = '';
    	    for (var i = 0; i < decoded.length; i++) {
    	        var line = decoded[i];
    	        if (i > 0)
    	            mappings += ';';
    	        if (line.length === 0)
    	            continue;
    	        var generatedCodeColumn = 0; // first field
    	        var lineMappings = [];
    	        for (var _i = 0, line_1 = line; _i < line_1.length; _i++) {
    	            var segment = line_1[_i];
    	            var segmentMappings = encodeInteger(segment[0] - generatedCodeColumn);
    	            generatedCodeColumn = segment[0];
    	            if (segment.length > 1) {
    	                segmentMappings +=
    	                    encodeInteger(segment[1] - sourceFileIndex) +
    	                        encodeInteger(segment[2] - sourceCodeLine) +
    	                        encodeInteger(segment[3] - sourceCodeColumn);
    	                sourceFileIndex = segment[1];
    	                sourceCodeLine = segment[2];
    	                sourceCodeColumn = segment[3];
    	            }
    	            if (segment.length === 5) {
    	                segmentMappings += encodeInteger(segment[4] - nameIndex);
    	                nameIndex = segment[4];
    	            }
    	            lineMappings.push(segmentMappings);
    	        }
    	        mappings += lineMappings.join(',');
    	    }
    	    return mappings;
    	}
    	function encodeInteger(num) {
    	    var result = '';
    	    num = num < 0 ? (-num << 1) | 1 : num << 1;
    	    do {
    	        var clamped = num & 31;
    	        num >>>= 5;
    	        if (num > 0) {
    	            clamped |= 32;
    	        }
    	        result += chars[clamped];
    	    } while (num > 0);
    	    return result;
    	}

    	// generate an ID that is, to all intents and purposes, unique
    	const id = (Math.round(Math.random() * 1e20)).toString(36);
    	const re = new RegExp(`_${id}_(?:(\\d+)|(AT)|(HASH))_(\\w+)?`, 'g');

    	function handle(node, state) {
    		const handler = handlers[node.type];

    		if (!handler) {
    			throw new Error(`Not implemented ${node.type}`);
    		}

    		const result = handler(node, state);

    		if (node.leadingComments) {
    			result.unshift(c(node.leadingComments.map(comment => comment.type === 'Block'
    				? `/*${comment.value}*/${(comment ).has_trailing_newline ? `\n${state.indent}` : ` `}`
    				: `//${comment.value}${(comment ).has_trailing_newline ? `\n${state.indent}` : ` `}`).join(``)));
    		}

    		if (node.trailingComments) {
    			state.comments.push(node.trailingComments[0]); // there is only ever one
    		}

    		return result;
    	}

    	function c(content, node) {
    		return {
    			content,
    			loc: node && node.loc,
    			has_newline: /\n/.test(content)
    		};
    	}

    	const OPERATOR_PRECEDENCE = {
    		'||': 3,
    		'&&': 4,
    		'|': 5,
    		'^': 6,
    		'&': 7,
    		'==': 8,
    		'!=': 8,
    		'===': 8,
    		'!==': 8,
    		'<': 9,
    		'>': 9,
    		'<=': 9,
    		'>=': 9,
    		in: 9,
    		instanceof: 9,
    		'<<': 10,
    		'>>': 10,
    		'>>>': 10,
    		'+': 11,
    		'-': 11,
    		'*': 12,
    		'%': 12,
    		'/': 12,
    		'**': 13,
    	};

    	// Enables parenthesis regardless of precedence
    	const NEEDS_PARENTHESES = 17;

    	const EXPRESSIONS_PRECEDENCE = {
    		ArrayExpression: 20,
    		TaggedTemplateExpression: 20,
    		ThisExpression: 20,
    		Identifier: 20,
    		Literal: 18,
    		TemplateLiteral: 20,
    		Super: 20,
    		SequenceExpression: 20,
    		MemberExpression: 19,
    		CallExpression: 19,
    		NewExpression: 19,
    		ArrowFunctionExpression: NEEDS_PARENTHESES,
    		ClassExpression: NEEDS_PARENTHESES,
    		FunctionExpression: NEEDS_PARENTHESES,
    		ObjectExpression: NEEDS_PARENTHESES, // TODO this results in e.g. `o = o || {}` => `o = o || ({})`
    		UpdateExpression: 16,
    		UnaryExpression: 15,
    		BinaryExpression: 14,
    		LogicalExpression: 13,
    		ConditionalExpression: 4,
    		AssignmentExpression: 3,
    		AwaitExpression: 2,
    		YieldExpression: 2,
    		RestElement: 1
    	};

    	function needs_parens(node, parent, is_right) {
    		const precedence = EXPRESSIONS_PRECEDENCE[node.type];

    		if (precedence === NEEDS_PARENTHESES) {
    			return true;
    		}

    		const parent_precedence = EXPRESSIONS_PRECEDENCE[parent.type];

    		if (precedence !== parent_precedence) {
    			// Different node types
    			return (
    				(!is_right &&
    					precedence === 15 &&
    					parent_precedence === 14 &&
    					parent.operator === '**') ||
    				precedence < parent_precedence
    			);
    		}

    		if (precedence !== 13 && precedence !== 14) {
    			// Not a `LogicalExpression` or `BinaryExpression`
    			return false;
    		}

    		if ((node ).operator === '**' && parent.operator === '**') {
    			// Exponentiation operator has right-to-left associativity
    			return !is_right;
    		}

    		if (is_right) {
    			// Parenthesis are used if both operators have the same precedence
    			return (
    				OPERATOR_PRECEDENCE[(node ).operator] <=
    				OPERATOR_PRECEDENCE[parent.operator]
    			);
    		}

    		return (
    			OPERATOR_PRECEDENCE[(node ).operator] <
    			OPERATOR_PRECEDENCE[parent.operator]
    		);
    	}

    	function has_call_expression(node) {
    		while (node) {
    			if (node.type[0] === 'CallExpression') {
    				return true;
    			} else if (node.type === 'MemberExpression') {
    				node = node.object;
    			} else {
    				return false;
    			}
    		}
    	}

    	const has_newline = (chunks) => {
    		for (let i = 0; i < chunks.length; i += 1) {
    			if (chunks[i].has_newline) return true;
    		}
    		return false;
    	};

    	const get_length = (chunks) => {
    		let total = 0;
    		for (let i = 0; i < chunks.length; i += 1) {
    			total += chunks[i].content.length;
    		}
    		return total;
    	};

    	const sum = (a, b) => a + b;

    	const join = (nodes, separator) => {
    		if (nodes.length === 0) return [];
    		const joined = [...nodes[0]];
    		for (let i = 1; i < nodes.length; i += 1) {
    			joined.push(separator, ...nodes[i] );
    		}
    		return joined;
    	};

    	const scoped = (fn) => {
    		return (node, state) => {
    			return fn(node, {
    				...state,
    				scope: state.scope_map.get(node)
    			});
    		};
    	};

    	const deconflict = (name, names) => {
    		const original = name;
    		let i = 1;

    		while (names.has(name)) {
    			name = `${original}$${i++}`;
    		}

    		return name;
    	};

    	const handle_body = (nodes, state) => {
    		const chunks = [];

    		const body = nodes.map(statement => {
    			const chunks = handle(statement, {
    				...state,
    				indent: state.indent
    			});

    			while (state.comments.length) {
    				const comment = state.comments.shift();
    				chunks.push(c(comment.type === 'Block'
    				? ` /*${comment.value}*/`
    				: ` //${comment.value}`));
    			}

    			return chunks;
    		});

    		let needed_padding = false;

    		for (let i = 0; i < body.length; i += 1) {
    			const needs_padding = has_newline(body[i]);

    			if (i > 0) {
    				chunks.push(
    					c(needs_padding || needed_padding ? `\n\n${state.indent}` : `\n${state.indent}`)
    				);
    			}

    			chunks.push(
    				...body[i]
    			);

    			needed_padding = needs_padding;
    		}

    		return chunks;
    	};

    	const handle_var_declaration = (node, state) => {
    		const chunks = [c(`${node.kind} `)];

    		const declarators = node.declarations.map(d => handle(d, {
    			...state,
    			indent: state.indent + (node.declarations.length === 1 ? '' : '\t')
    		}));

    		const multiple_lines = (
    			declarators.some(has_newline) ||
    			(declarators.map(get_length).reduce(sum, 0) + (state.indent.length + declarators.length - 1) * 2) > 80
    		);

    		const separator = c(multiple_lines ? `,\n${state.indent}\t` : ', ');

    		if (multiple_lines) {
    			chunks.push(...join(declarators, separator));
    		} else {
    			chunks.push(
    				...join(declarators, separator)
    			);
    		}

    		return chunks;
    	};

    	const handlers = {
    		Program(node, state) {
    			return handle_body(node.body, state);
    		},

    		BlockStatement: scoped((node, state) => {
    			return [
    				c(`{\n${state.indent}\t`),
    				...handle_body(node.body, { ...state, indent: state.indent + '\t' }),
    				c(`\n${state.indent}}`)
    			];
    		}),

    		EmptyStatement(node, state) {
    			return [];
    		},

    		ExpressionStatement(node, state) {
    			const precedence = EXPRESSIONS_PRECEDENCE[node.expression.type];
    			if (
    				precedence === NEEDS_PARENTHESES ||
    				(precedence === 3 && (node.expression ).left.type === 'ObjectPattern')
    			) {
    				// Should always have parentheses or is an AssignmentExpression to an ObjectPattern
    				return [
    					c('('),
    					...handle(node.expression, state),
    					c(');')
    				];
    			}

    			return [
    				...handle(node.expression, state),
    				c(';')
    			];
    		},

    		IfStatement(node, state) {
    			const chunks = [
    				c('if ('),
    				...handle(node.test, state),
    				c(') '),
    				...handle(node.consequent, state)
    			];

    			if (node.alternate) {
    				chunks.push(
    					c(' else '),
    					...handle(node.alternate, state)
    				);
    			}

    			return chunks;
    		},

    		LabeledStatement(node, state) {
    			return [
    				...handle(node.label, state),
    				c(': '),
    				...handle(node.body, state)
    			];
    		},

    		BreakStatement(node, state) {
    			return node.label
    				? [c('break '), ...handle(node.label, state), c(';')]
    				: [c('break;')];
    		},

    		ContinueStatement(node, state) {
    			return node.label
    				? [c('continue '), ...handle(node.label, state), c(';')]
    				: [c('continue;')];
    		},

    		WithStatement(node, state) {
    			return [
    				c('with ('),
    				...handle(node.object, state),
    				c(') '),
    				...handle(node.body, state)
    			];
    		},

    		SwitchStatement(node, state) {
    			const chunks = [
    				c('switch ('),
    				...handle(node.discriminant, state),
    				c(') {')
    			];

    			node.cases.forEach(block => {
    				if (block.test) {
    					chunks.push(
    						c(`\n${state.indent}\tcase `),
    						...handle(block.test, { ...state, indent: `${state.indent}\t` }),
    						c(':')
    					);
    				} else {
    					chunks.push(c(`\n${state.indent}\tdefault:`));
    				}

    				block.consequent.forEach(statement => {
    					chunks.push(
    						c(`\n${state.indent}\t\t`),
    						...handle(statement, { ...state, indent: `${state.indent}\t\t` })
    					);
    				});
    			});

    			chunks.push(c(`\n${state.indent}}`));

    			return chunks;
    		},

    		ReturnStatement(node, state) {
    			if (node.argument) {
    				return [
    					c('return '),
    					...handle(node.argument, state),
    					c(';')
    				];
    			} else {
    				return [c('return;')];
    			}
    		},

    		ThrowStatement(node, state) {
    			return [
    				c('throw '),
    				...handle(node.argument, state),
    				c(';')
    			];
    		},

    		TryStatement(node, state) {
    			const chunks = [
    				c('try '),
    				...handle(node.block, state)
    			];

    			if (node.handler) {
    				if (node.handler.param) {
    					chunks.push(
    						c(' catch('),
    						...handle(node.handler.param, state),
    						c(') ')
    					);
    				} else {
    					chunks.push(c(' catch '));
    				}

    				chunks.push(...handle(node.handler.body, state));
    			}

    			if (node.finalizer) {
    				chunks.push(c(' finally '), ...handle(node.finalizer, state));
    			}

    			return chunks;
    		},

    		WhileStatement(node, state) {
    			return [
    				c('while ('),
    				...handle(node.test, state),
    				c(') '),
    				...handle(node.body, state)
    			];
    		},

    		DoWhileStatement(node, state) {
    			return [
    				c('do '),
    				...handle(node.body, state),
    				c(' while ('),
    				...handle(node.test, state),
    				c(');')
    			];
    		},

    		ForStatement: scoped((node, state) => {
    			const chunks = [c('for (')];

    			if (node.init) {
    				if ((node.init ).type === 'VariableDeclaration') {
    					chunks.push(...handle_var_declaration(node.init , state));
    				} else {
    					chunks.push(...handle(node.init, state));
    				}
    			}

    			chunks.push(c('; '));
    			if (node.test) chunks.push(...handle(node.test, state));
    			chunks.push(c('; '));
    			if (node.update) chunks.push(...handle(node.update, state));

    			chunks.push(
    				c(') '),
    				...handle(node.body, state)
    			);

    			return chunks;
    		}),

    		ForInStatement: scoped((node, state) => {
    			const chunks = [
    				c(`for ${(node ).await ? 'await ' : ''}(`)
    			];

    			if ((node.left ).type === 'VariableDeclaration') {
    				chunks.push(...handle_var_declaration(node.left , state));
    			} else {
    				chunks.push(...handle(node.left, state));
    			}

    			chunks.push(
    				c(node.type === 'ForInStatement' ? ` in ` : ` of `),
    				...handle(node.right, state),
    				c(') '),
    				...handle(node.body, state)
    			);

    			return chunks;
    		}),

    		DebuggerStatement(node, state) {
    			return [c('debugger', node), c(';')];
    		},

    		FunctionDeclaration: scoped((node, state) => {
    			const chunks = [];

    			if (node.async) chunks.push(c('async '));
    			chunks.push(c(node.generator ? 'function* ' : 'function '));
    			if (node.id) chunks.push(...handle(node.id, state));
    			chunks.push(c('('));

    			const params = node.params.map(p => handle(p, {
    				...state,
    				indent: state.indent + '\t'
    			}));

    			const multiple_lines = (
    				params.some(has_newline) ||
    				(params.map(get_length).reduce(sum, 0) + (state.indent.length + params.length - 1) * 2) > 80
    			);

    			const separator = c(multiple_lines ? `,\n${state.indent}` : ', ');

    			if (multiple_lines) {
    				chunks.push(
    					c(`\n${state.indent}\t`),
    					...join(params, separator),
    					c(`\n${state.indent}`)
    				);
    			} else {
    				chunks.push(
    					...join(params, separator)
    				);
    			}

    			chunks.push(
    				c(') '),
    				...handle(node.body, state)
    			);

    			return chunks;
    		}),

    		VariableDeclaration(node, state) {
    			return handle_var_declaration(node, state).concat(c(';'));
    		},

    		VariableDeclarator(node, state) {
    			if (node.init) {
    				return [
    					...handle(node.id, state),
    					c(' = '),
    					...handle(node.init, state)
    				];
    			} else {
    				return handle(node.id, state);
    			}
    		},

    		ClassDeclaration(node, state) {
    			const chunks = [c('class ')];

    			if (node.id) chunks.push(...handle(node.id, state), c(' '));

    			if (node.superClass) {
    				chunks.push(
    					c('extends '),
    					...handle(node.superClass, state),
    					c(' ')
    				);
    			}

    			chunks.push(...handle(node.body, state));

    			return chunks;
    		},

    		ImportDeclaration(node, state) {
    			const chunks = [c('import ')];

    			const { length } = node.specifiers;
    			const source = handle(node.source, state);

    			if (length > 0) {
    				let i = 0;

    				while (i < length) {
    					if (i > 0) {
    						chunks.push(c(', '));
    					}

    					const specifier = node.specifiers[i];

    					if (specifier.type === 'ImportDefaultSpecifier') {
    						chunks.push(c(specifier.local.name, specifier));
    						i += 1;
    					} else if (specifier.type === 'ImportNamespaceSpecifier') {
    						chunks.push(c('* as ' + specifier.local.name, specifier));
    						i += 1;
    					} else {
    						break;
    					}
    				}

    				if (i < length) {
    					// we have named specifiers
    					const specifiers = node.specifiers.slice(i).map((specifier) => {
    						const name = handle(specifier.imported, state)[0];
    						const as = handle(specifier.local, state)[0];

    						if (name.content === as.content) {
    							return [as];
    						}

    						return [name, c(' as '), as];
    					});

    					const width = get_length(chunks) + specifiers.map(get_length).reduce(sum, 0) + (2 * specifiers.length) + 6 + get_length(source);

    					if (width > 80) {
    						chunks.push(
    							c(`{\n\t`),
    							...join(specifiers, c(',\n\t')),
    							c('\n}')
    						);
    					} else {
    						chunks.push(
    							c(`{ `),
    							...join(specifiers, c(', ')),
    							c(' }')
    						);
    					}
    				}

    				chunks.push(c(' from '));
    			}

    			chunks.push(
    				...source,
    				c(';')
    			);

    			return chunks;
    		},

    		ImportExpression(node, state) {
    			return [c('import('), ...handle(node.source, state), c(')')];
    		},

    		ExportDefaultDeclaration(node, state) {
    			const chunks = [
    				c(`export default `),
    				...handle(node.declaration, state)
    			];

    			if (node.declaration.type !== 'FunctionDeclaration') {
    				chunks.push(c(';'));
    			}

    			return chunks;
    		},

    		ExportNamedDeclaration(node, state) {
    			const chunks = [c('export ')];

    			if (node.declaration) {
    				chunks.push(...handle(node.declaration, state));
    			} else {
    				const specifiers = node.specifiers.map(specifier => {
    					const name = handle(specifier.local, state)[0];
    					const as = handle(specifier.exported, state)[0];

    					if (name.content === as.content) {
    						return [name];
    					}

    					return [name, c(' as '), as];
    				});

    				const width = 7 + specifiers.map(get_length).reduce(sum, 0) + 2 * specifiers.length;

    				if (width > 80) {
    					chunks.push(
    						c('{\n\t'),
    						...join(specifiers, c(',\n\t')),
    						c('\n}')
    					);
    				} else {
    					chunks.push(
    						c('{ '),
    						...join(specifiers, c(', ')),
    						c(' }')
    					);
    				}

    				if (node.source) {
    					chunks.push(
    						c(' from '),
    						...handle(node.source, state)
    					);
    				}
    			}

    			chunks.push(c(';'));

    			return chunks;
    		},

    		ExportAllDeclaration(node, state) {
    			return [
    				c(`export * from `),
    				...handle(node.source, state),
    				c(`;`)
    			];
    		},

    		MethodDefinition(node, state) {
    			const chunks = [];

    			if (node.static) {
    				chunks.push(c('static '));
    			}

    			if (node.kind === 'get' || node.kind === 'set') {
    				// Getter or setter
    				chunks.push(c(node.kind + ' '));
    			}

    			if (node.value.async) {
    				chunks.push(c('async '));
    			}

    			if (node.value.generator) {
    				chunks.push(c('*'));
    			}

    			if (node.computed) {
    				chunks.push(
    					c('['),
    					...handle(node.key, state),
    					c(']')
    				);
    			} else {
    				chunks.push(...handle(node.key, state));
    			}

    			chunks.push(c('('));

    			const { params } = node.value;
    			for (let i = 0; i < params.length; i += 1) {
    				chunks.push(...handle(params[i], state));
    				if (i < params.length - 1) chunks.push(c(', '));
    			}

    			chunks.push(
    				c(') '),
    				...handle(node.value.body, state)
    			);

    			return chunks;
    		},

    		ArrowFunctionExpression: scoped((node, state) => {
    			const chunks = [];

    			if (node.async) chunks.push(c('async '));

    			if (node.params.length === 1 && node.params[0].type === 'Identifier') {
    				chunks.push(...handle(node.params[0], state));
    			} else {
    				const params = node.params.map(param => handle(param, {
    					...state,
    					indent: state.indent + '\t'
    				}));

    				chunks.push(
    					c('('),
    					...join(params, c(', ')),
    					c(')')
    				);
    			}

    			chunks.push(c(' => '));

    			if (node.body.type === 'ObjectExpression') {
    				chunks.push(
    					c('('),
    					...handle(node.body, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.body, state));
    			}

    			return chunks;
    		}),

    		ThisExpression(node, state) {
    			return [c('this', node)];
    		},

    		Super(node, state) {
    			return [c('super', node)];
    		},

    		RestElement(node, state) {
    			return [c('...'), ...handle(node.argument, state)];
    		},

    		YieldExpression(node, state) {
    			if (node.argument) {
    				return [c(node.delegate ? `yield* ` : `yield `), ...handle(node.argument, state)];
    			}

    			return [c(node.delegate ? `yield*` : `yield`)];
    		},

    		AwaitExpression(node, state) {
    			if (node.argument) {
    				return [c('await '), ...handle(node.argument, state)];
    			}

    			return [c('await')];
    		},

    		TemplateLiteral(node, state) {
    			const chunks = [c('`')];

    			const { quasis, expressions } = node;

    			for (let i = 0; i < expressions.length; i++) {
    				chunks.push(
    					c(quasis[i].value.raw),
    					c('${'),
    					...handle(expressions[i], state),
    					c('}')
    				);
    			}

    			chunks.push(
    				c(quasis[quasis.length - 1].value.raw),
    				c('`')
    			);

    			return chunks;
    		},

    		TaggedTemplateExpression(node, state) {
    			return handle(node.tag, state).concat(handle(node.quasi, state));
    		},

    		ArrayExpression(node, state) {
    			const chunks = [c('[')];

    			const elements = [];
    			let sparse_commas = [];

    			for (let i = 0; i < node.elements.length; i += 1) {
    				// can't use map/forEach because of sparse arrays
    				const element = node.elements[i];
    				if (element) {
    					elements.push([...sparse_commas, ...handle(element, {
    						...state,
    						indent: state.indent + '\t'
    					})]);
    					sparse_commas = [];
    				} else {
    					sparse_commas.push(c(','));
    				}
    			}

    			const multiple_lines = (
    				elements.some(has_newline) ||
    				(elements.map(get_length).reduce(sum, 0) + (state.indent.length + elements.length - 1) * 2) > 80
    			);

    			if (multiple_lines) {
    				chunks.push(
    					c(`\n${state.indent}\t`),
    					...join(elements, c(`,\n${state.indent}\t`)),
    					c(`\n${state.indent}`),
    					...sparse_commas
    				);
    			} else {
    				chunks.push(...join(elements, c(', ')), ...sparse_commas);
    			}

    			chunks.push(c(']'));

    			return chunks;
    		},

    		ObjectExpression(node, state) {
    			if (node.properties.length === 0) {
    				return [c('{}')];
    			}

    			let has_inline_comment = false;

    			const chunks = [];
    			const separator = c(', ');

    			node.properties.forEach((p, i) => {
    				chunks.push(...handle(p, {
    					...state,
    					indent: state.indent + '\t'
    				}));

    				if (state.comments.length) {
    					// TODO generalise this, so it works with ArrayExpressions and other things.
    					// At present, stuff will just get appended to the closest statement/declaration
    					chunks.push(c(', '));

    					while (state.comments.length) {
    						const comment = state.comments.shift();

    						chunks.push(c(comment.type === 'Block'
    							? `/*${comment.value}*/\n${state.indent}\t`
    							: `//${comment.value}\n${state.indent}\t`));

    						if (comment.type === 'Line') {
    							has_inline_comment = true;
    						}
    					}
    				} else {
    					if (i < node.properties.length - 1) {
    						chunks.push(separator);
    					}
    				}
    			});

    			const multiple_lines = (
    				has_inline_comment ||
    				has_newline(chunks) ||
    				get_length(chunks) > 40
    			);

    			if (multiple_lines) {
    				separator.content = `,\n${state.indent}\t`;
    			}

    			return [
    				c(multiple_lines ? `{\n${state.indent}\t` : `{ `),
    				...chunks,
    				c(multiple_lines ? `\n${state.indent}}` : ` }`)
    			];
    		},

    		Property(node, state) {
    			const value = handle(node.value, state);

    			if (node.key === node.value) {
    				return value;
    			}

    			// special case
    			if (
    				!node.computed &&
    				node.value.type === 'AssignmentPattern' &&
    				node.value.left.type === 'Identifier' &&
    				node.value.left.name === (node.key ).name
    			) {
    				return value;
    			}

    			if (node.value.type === 'Identifier' && (
    				(node.key.type === 'Identifier' && node.key.name === value[0].content) ||
    				(node.key.type === 'Literal' && node.key.value === value[0].content)
    			)) {
    				return value;
    			}

    			const key = handle(node.key, state);

    			if (node.value.type === 'FunctionExpression' && !node.value.id) {
    				state = {
    					...state,
    					scope: state.scope_map.get(node.value)
    				};

    				const chunks = node.kind !== 'init'
    					? [c(`${node.kind} `)]
    					: [];

    				if (node.value.async) {
    					chunks.push(c('async '));
    				}
    				if (node.value.generator) {
    					chunks.push(c('*'));
    				}

    				chunks.push(
    					...(node.computed ? [c('['), ...key, c(']')] : key),
    					c('('),
    					...join((node.value ).params.map(param => handle(param, state)), c(', ')),
    					c(') '),
    					...handle((node.value ).body, state)
    				);

    				return chunks;
    			}

    			if (node.computed) {
    				return [
    					c('['),
    					...key,
    					c(']: '),
    					...value
    				];
    			}

    			return [
    				...key,
    				c(': '),
    				...value
    			];
    		},

    		ObjectPattern(node, state) {
    			const chunks = [c('{ ')];

    			for (let i = 0; i < node.properties.length; i += 1) {
    				chunks.push(...handle(node.properties[i], state));
    				if (i < node.properties.length - 1) chunks.push(c(', '));
    			}

    			chunks.push(c(' }'));

    			return chunks;
    		},

    		SequenceExpression(node, state) {
    			const expressions = node.expressions.map(e => handle(e, state));

    			return [
    				c('('),
    				...join(expressions, c(', ')),
    				c(')')
    			];
    		},

    		UnaryExpression(node, state) {
    			const chunks = [c(node.operator)];

    			if (node.operator.length > 1) {
    				chunks.push(c(' '));
    			}

    			if (
    				EXPRESSIONS_PRECEDENCE[node.argument.type] <
    				EXPRESSIONS_PRECEDENCE.UnaryExpression
    			) {
    				chunks.push(
    					c('('),
    					...handle(node.argument, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.argument, state));
    			}

    			return chunks;
    		},

    		UpdateExpression(node, state) {
    			return node.prefix
    				? [c(node.operator), ...handle(node.argument, state)]
    				: [...handle(node.argument, state), c(node.operator)];
    		},

    		AssignmentExpression(node, state) {
    			return [
    				...handle(node.left, state),
    				c(` ${node.operator || '='} `),
    				...handle(node.right, state)
    			];
    		},

    		BinaryExpression(node, state) {
    			const chunks = [];

    			// TODO
    			// const is_in = node.operator === 'in';
    			// if (is_in) {
    			// 	// Avoids confusion in `for` loops initializers
    			// 	chunks.push(c('('));
    			// }

    			if (needs_parens(node.left, node, false)) {
    				chunks.push(
    					c('('),
    					...handle(node.left, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.left, state));
    			}

    			chunks.push(c(` ${node.operator} `));

    			if (needs_parens(node.right, node, true)) {
    				chunks.push(
    					c('('),
    					...handle(node.right, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.right, state));
    			}

    			return chunks;
    		},

    		ConditionalExpression(node, state) {
    			const chunks = [];

    			if (
    				EXPRESSIONS_PRECEDENCE[node.test.type] >
    				EXPRESSIONS_PRECEDENCE.ConditionalExpression
    			) {
    				chunks.push(...handle(node.test, state));
    			} else {
    				chunks.push(
    					c('('),
    					...handle(node.test, state),
    					c(')')
    				);
    			}

    			const child_state = { ...state, indent: state.indent + '\t' };

    			const consequent = handle(node.consequent, child_state);
    			const alternate = handle(node.alternate, child_state);

    			const multiple_lines = (
    				has_newline(consequent) || has_newline(alternate) ||
    				get_length(chunks) + get_length(consequent) + get_length(alternate) > 50
    			);

    			if (multiple_lines) {
    				chunks.push(
    					c(`\n${state.indent}? `),
    					...consequent,
    					c(`\n${state.indent}: `),
    					...alternate
    				);
    			} else {
    				chunks.push(
    					c(` ? `),
    					...consequent,
    					c(` : `),
    					...alternate
    				);
    			}

    			return chunks;
    		},

    		NewExpression(node, state) {
    			const chunks = [c('new ')];

    			if (
    				EXPRESSIONS_PRECEDENCE[node.callee.type] <
    				EXPRESSIONS_PRECEDENCE.CallExpression || has_call_expression(node.callee)
    			) {
    				chunks.push(
    					c('('),
    					...handle(node.callee, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.callee, state));
    			}

    			// TODO this is copied from CallExpression — DRY it out
    			const args = node.arguments.map(arg => handle(arg, {
    				...state,
    				indent: state.indent + '\t'
    			}));

    			const separator = args.some(has_newline) // TODO or length exceeds 80
    				? c(',\n' + state.indent)
    				: c(', ');

    			chunks.push(
    				c('('),
    				...join(args, separator) ,
    				c(')')
    			);

    			return chunks;
    		},

    		CallExpression(node, state) {
    			const chunks = [];

    			if (
    				EXPRESSIONS_PRECEDENCE[node.callee.type] <
    				EXPRESSIONS_PRECEDENCE.CallExpression
    			) {
    				chunks.push(
    					c('('),
    					...handle(node.callee, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.callee, state));
    			}

    			const args = node.arguments.map(arg => handle(arg, state));

    			const multiple_lines = args.slice(0, -1).some(has_newline); // TODO or length exceeds 80

    			if (multiple_lines) {
    				// need to handle args again. TODO find alternative approach?
    				const args = node.arguments.map(arg => handle(arg, {
    					...state,
    					indent: `${state.indent}\t`
    				}));

    				chunks.push(
    					c(`(\n${state.indent}\t`),
    					...join(args, c(`,\n${state.indent}\t`)),
    					c(`\n${state.indent})`)
    				);
    			} else {
    				chunks.push(
    					c('('),
    					...join(args, c(', ')),
    					c(')')
    				);
    			}

    			return chunks;
    		},

    		MemberExpression(node, state) {
    			const chunks = [];

    			if (EXPRESSIONS_PRECEDENCE[node.object.type] < EXPRESSIONS_PRECEDENCE.MemberExpression) {
    				chunks.push(
    					c('('),
    					...handle(node.object, state),
    					c(')')
    				);
    			} else {
    				chunks.push(...handle(node.object, state));
    			}

    			if (node.computed) {
    				chunks.push(
    					c('['),
    					...handle(node.property, state),
    					c(']')
    				);
    			} else {
    				chunks.push(
    					c('.'),
    					...handle(node.property, state)
    				);
    			}

    			return chunks;
    		},

    		MetaProperty(node, state) {
    			return [...handle(node.meta, state), c('.'), ...handle(node.property, state)];
    		},

    		Identifier(node, state) {
    			let name = node.name;

    			if (name[0] === '@') {
    				name = state.getName(name.slice(1));
    			} else if (node.name[0] === '#') {
    				const owner = state.scope.find_owner(node.name);

    				if (!owner) {
    					throw new Error(`Could not find owner for node`);
    				}

    				if (!state.deconflicted.has(owner)) {
    					state.deconflicted.set(owner, new Map());
    				}

    				const deconflict_map = state.deconflicted.get(owner);

    				if (!deconflict_map.has(node.name)) {
    					deconflict_map.set(node.name, deconflict(node.name.slice(1), owner.references));
    				}

    				name = deconflict_map.get(node.name);
    			}

    			return [c(name, node)];
    		},

    		Literal(node, state) {
    			if (typeof node.value === 'string') {
    				return [
    					// TODO do we need to handle weird unicode characters somehow?
    					// str.replace(/\\u(\d{4})/g, (m, n) => String.fromCharCode(+n))
    					c(JSON.stringify(node.value).replace(re, (_m, _i, at, hash, name) => {
    						if (at)	return '@' + name;
    						if (hash) return '#' + name;
    						throw new Error(`this shouldn't happen`);
    					}), node)
    				];
    			}

    			const { regex } = node ; // TODO is this right?
    			if (regex) {
    				return [c(`/${regex.pattern}/${regex.flags}`, node)];
    			}

    			return [c(String(node.value), node)];
    		}
    	};

    	handlers.ForOfStatement = handlers.ForInStatement;
    	handlers.FunctionExpression = handlers.FunctionDeclaration;
    	handlers.ClassExpression = handlers.ClassDeclaration;
    	handlers.ClassBody = handlers.BlockStatement;
    	handlers.SpreadElement = handlers.RestElement;
    	handlers.ArrayPattern = handlers.ArrayExpression;
    	handlers.LogicalExpression = handlers.BinaryExpression;
    	handlers.AssignmentPattern = handlers.AssignmentExpression;

    	function print(node, opts = {}) {
    		if (Array.isArray(node)) {
    			return print({
    				type: 'Program',
    				body: node
    			} , opts);
    		}

    		const {
    			getName = (x) => x
    		} = opts;

    		let { map: scope_map, scope } = analyze(node);
    		const deconflicted = new WeakMap();

    		const chunks = handle(node, {
    			indent: '',
    			getName,
    			scope,
    			scope_map,
    			deconflicted,
    			comments: []
    		});

    		

    		let code = '';
    		let mappings = [];
    		let current_line = [];
    		let current_column = 0;

    		for (let i = 0; i < chunks.length; i += 1) {
    			const chunk = chunks[i];

    			code += chunk.content;

    			if (chunk.loc) {
    				current_line.push([
    					current_column,
    					0, // source index is always zero
    					chunk.loc.start.line - 1,
    					chunk.loc.start.column,
    				]);
    			}

    			for (let i = 0; i < chunk.content.length; i += 1) {
    				if (chunk.content[i] === '\n') {
    					mappings.push(current_line);
    					current_line = [];
    					current_column = 0;
    				} else {
    					current_column += 1;
    				}
    			}

    			if (chunk.loc) {
    				current_line.push([
    					current_column,
    					0, // source index is always zero
    					chunk.loc.end.line - 1,
    					chunk.loc.end.column,
    				]);
    			}
    		}

    		mappings.push(current_line);

    		return {
    			code,
    			map: {
    				version: 3,
    				names: [],
    				sources: [opts.sourceMapSource || null],
    				sourcesContent: [opts.sourceMapContent || null],
    				mappings: encode(mappings)
    			}
    		};
    	}

    	const sigils = {
    		'@': 'AT',
    		'#': 'HASH'
    	};

    	const join$1 = (strings) => {
    		let str = strings[0];
    		for (let i = 1; i < strings.length; i += 1) {
    			str += `_${id}_${i - 1}_${strings[i]}`;
    		}
    		return str.replace(/([@#])(\w+)/g, (_m, sigil, name) => `_${id}_${sigils[sigil]}_${name}`);
    	};

    	const flatten_body = (array, target) => {
    		for (let i = 0; i < array.length; i += 1) {
    			const statement = array[i];
    			if (Array.isArray(statement)) {
    				flatten_body(statement, target);
    				continue;
    			}

    			if (statement.type === 'ExpressionStatement') {
    				if (statement.expression === EMPTY) continue;

    				if (Array.isArray(statement.expression)) {
    					// TODO this is hacktacular
    					let node = statement.expression[0];
    					while (Array.isArray(node)) node = node[0];
    					if (node) node.leadingComments = statement.leadingComments;

    					flatten_body(statement.expression, target);
    					continue;
    				}

    				if (/(Expression|Literal)$/.test(statement.expression.type)) {
    					target.push(statement);
    					continue;
    				}

    				if (statement.leadingComments) statement.expression.leadingComments = statement.leadingComments;
    				if (statement.trailingComments) statement.expression.trailingComments = statement.trailingComments;

    				target.push(statement.expression);
    				continue;
    			}

    			target.push(statement);
    		}

    		return target;
    	};

    	const flatten_properties = (array, target) => {
    		for (let i = 0; i < array.length; i += 1) {
    			const property = array[i];

    			if (property.value === EMPTY) continue;

    			if (property.key === property.value && Array.isArray(property.key)) {
    				flatten_properties(property.key, target);
    				continue;
    			}

    			target.push(property);
    		}

    		return target;
    	};

    	const flatten = (nodes, target) => {
    		for (let i = 0; i < nodes.length; i += 1) {
    			const node = nodes[i];

    			if (node === EMPTY) continue;

    			if (Array.isArray(node)) {
    				flatten(node, target);
    				continue;
    			}

    			target.push(node);
    		}

    		return target;
    	};

    	const EMPTY = { type: 'Empty' };

    	const acorn_opts = (comments, raw) => {
    		return {
    			ecmaVersion: 11,
    			sourceType: 'module',
    			allowAwaitOutsideFunction: true,
    			allowImportExportEverywhere: true,
    			allowReturnOutsideFunction: true,
    			onComment: (block, value, start, end) => {
    				if (block && /\n/.test(value)) {
    					let a = start;
    					while (a > 0 && raw[a - 1] !== '\n') a -= 1;

    					let b = a;
    					while (/[ \t]/.test(raw[b])) b += 1;

    					const indentation = raw.slice(a, b);
    					value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
    				}

    				comments.push({ type: block ? 'Block' : 'Line', value, start, end });
    			}
    		} ;
    	};

    	const inject = (raw, node, values, comments) => {
    		comments.forEach(comment => {
    			comment.value = comment.value.replace(re, (m, i) => +i in values ? values[+i] : m);
    		});

    		walk(node, {
    			enter(node) {
    				let comment;

    				while (comments[0] && comments[0].start < (node ).start) {
    					comment = comments.shift();

    					const next = comments[0] || node;
    					(comment ).has_trailing_newline = (
    						comment.type === 'Line' ||
    						/\n/.test(raw.slice(comment.end, (next ).start))
    					);

    					(node.leadingComments || (node.leadingComments = [])).push(comment);
    				}
    			},

    			leave(node, parent, key, index) {
    				if (node.type === 'Identifier') {
    					re.lastIndex = 0;
    					const match = re.exec(node.name);

    					if (match) {
    						if (match[1]) {
    							if (+match[1] in values) {
    								let value = values[+match[1]];

    								if (typeof value === 'string') {
    									value = { type: 'Identifier', name: value, leadingComments: node.leadingComments, trailingComments: node.trailingComments };
    								} else if (typeof value === 'number') {
    									value = { type: 'Literal', value, leadingComments: node.leadingComments, trailingComments: node.trailingComments };
    								}

    								this.replace(value || EMPTY);
    							}
    						} else {
    							node.name = `${match[2] ? `@` : `#`}${match[4]}`;
    						}
    					}
    				}

    				if (node.type === 'Literal') {
    					if (typeof node.value === 'string') {
    						re.lastIndex = 0;
    						node.value = node.value.replace(re, (m, i) => +i in values ? values[+i] : m);
    					}
    				}

    				if (node.type === 'TemplateElement') {
    					re.lastIndex = 0;
    					node.value.raw = (node.value.raw ).replace(re, (m, i) => +i in values ? values[+i] : m);
    				}

    				if (node.type === 'Program' || node.type === 'BlockStatement') {
    					node.body = flatten_body(node.body, []);
    				}

    				if (node.type === 'ObjectExpression' || node.type === 'ObjectPattern') {
    					node.properties = flatten_properties(node.properties, []);
    				}

    				if (node.type === 'ArrayExpression' || node.type === 'ArrayPattern') {
    					node.elements = flatten(node.elements, []);
    				}

    				if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') {
    					node.params = flatten(node.params, []);
    				}

    				if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    					node.arguments = flatten(node.arguments, []);
    				}

    				if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') {
    					node.specifiers = flatten(node.specifiers, []);
    				}

    				if (node.type === 'ForStatement') {
    					node.init = node.init === EMPTY ? null : node.init;
    					node.test = node.test === EMPTY ? null : node.test;
    					node.update = node.update === EMPTY ? null : node.update;
    				}

    				if (comments[0]) {
    					const slice = raw.slice((node ).end, comments[0].start);

    					if (/^[,) \t]*$/.test(slice)) {
    						node.trailingComments = [comments.shift()];
    					}
    				}
    			}
    		});
    	};

    	function b(strings, ...values) {
    		const str = join$1(strings);
    		const comments = [];

    		try {
    			const ast = parse(str,  acorn_opts(comments, str));

    			inject(str, ast, values, comments);

    			return ast.body;
    		} catch (err) {
    			handle_error(str, err);
    		}
    	}

    	function x(strings, ...values) {
    		const str = join$1(strings);
    		const comments = [];

    		try {
    			const expression = parseExpressionAt(str, 0, acorn_opts(comments, str)) ;

    			inject(str, expression, values, comments);

    			return expression;
    		} catch (err) {
    			handle_error(str, err);
    		}
    	}

    	function p(strings, ...values) {
    		const str = `{${join$1(strings)}}`;
    		const comments = [];

    		try {
    			const expression = parseExpressionAt(str, 0, acorn_opts(comments, str)) ;

    			inject(str, expression, values, comments);

    			return expression.properties[0];
    		} catch (err) {
    			handle_error(str, err);
    		}
    	}

    	function handle_error(str, err) {
    		// TODO location/code frame

    		re.lastIndex = 0;

    		str = str.replace(re, (m, i, at, hash, name) => {
    			if (at) return `@${name}`;
    			if (hash) return `#${name}`;

    			return '${...}';
    		});

    		console.log(`failed to parse:\n${str}`);
    		throw err;
    	}

    	function is_head(node) {
    	    return node && node.type === 'MemberExpression' && node.object.name === '@_document' && node.property.name === 'head';
    	}

    	class Block$1 {
    	    constructor(options) {
    	        this.dependencies = new Set();
    	        this.event_listeners = [];
    	        this.variables = new Map();
    	        this.has_update_method = false;
    	        this.parent = options.parent;
    	        this.renderer = options.renderer;
    	        this.name = options.name;
    	        this.type = options.type;
    	        this.comment = options.comment;
    	        this.wrappers = [];
    	        // for keyed each blocks
    	        this.key = options.key;
    	        this.first = null;
    	        this.bindings = options.bindings;
    	        this.chunks = {
    	            init: [],
    	            create: [],
    	            claim: [],
    	            hydrate: [],
    	            mount: [],
    	            measure: [],
    	            fix: [],
    	            animate: [],
    	            intro: [],
    	            update: [],
    	            outro: [],
    	            destroy: [],
    	        };
    	        this.has_animation = false;
    	        this.has_intro_method = false; // a block could have an intro method but not intro transitions, e.g. if a sibling block has intros
    	        this.has_outro_method = false;
    	        this.outros = 0;
    	        this.get_unique_name = this.renderer.component.get_unique_name_maker();
    	        this.aliases = new Map();
    	        if (this.key)
    	            this.aliases.set('key', this.get_unique_name('key'));
    	    }
    	    assign_variable_names() {
    	        const seen = new Set();
    	        const dupes = new Set();
    	        let i = this.wrappers.length;
    	        while (i--) {
    	            const wrapper = this.wrappers[i];
    	            if (!wrapper.var)
    	                continue;
    	            if (seen.has(wrapper.var.name)) {
    	                dupes.add(wrapper.var.name);
    	            }
    	            seen.add(wrapper.var.name);
    	        }
    	        const counts = new Map();
    	        i = this.wrappers.length;
    	        while (i--) {
    	            const wrapper = this.wrappers[i];
    	            if (!wrapper.var)
    	                continue;
    	            let suffix = '';
    	            if (dupes.has(wrapper.var.name)) {
    	                const i = counts.get(wrapper.var.name) || 0;
    	                counts.set(wrapper.var.name, i + 1);
    	                suffix = i;
    	            }
    	            wrapper.var.name = this.get_unique_name(wrapper.var.name + suffix).name;
    	        }
    	    }
    	    add_dependencies(dependencies) {
    	        dependencies.forEach(dependency => {
    	            this.dependencies.add(dependency);
    	        });
    	        this.has_update_method = true;
    	    }
    	    add_element(id, render_statement, claim_statement, parent_node, no_detach) {
    	        this.add_variable(id);
    	        this.chunks.create.push(b `${id} = ${render_statement};`);
    	        if (this.renderer.options.hydratable) {
    	            this.chunks.claim.push(b `${id} = ${claim_statement || render_statement};`);
    	        }
    	        if (parent_node) {
    	            this.chunks.mount.push(b `@append(${parent_node}, ${id});`);
    	            if (is_head(parent_node) && !no_detach)
    	                this.chunks.destroy.push(b `@detach(${id});`);
    	        }
    	        else {
    	            this.chunks.mount.push(b `@insert(#target, ${id}, anchor);`);
    	            if (!no_detach)
    	                this.chunks.destroy.push(b `if (detaching) @detach(${id});`);
    	        }
    	    }
    	    add_intro(local) {
    	        this.has_intros = this.has_intro_method = true;
    	        if (!local && this.parent)
    	            this.parent.add_intro();
    	    }
    	    add_outro(local) {
    	        this.has_outros = this.has_outro_method = true;
    	        this.outros += 1;
    	        if (!local && this.parent)
    	            this.parent.add_outro();
    	    }
    	    add_animation() {
    	        this.has_animation = true;
    	    }
    	    add_variable(id, init) {
    	        if (this.variables.has(id.name)) {
    	            throw new Error(`Variable '${id.name}' already initialised with a different value`);
    	        }
    	        this.variables.set(id.name, { id, init });
    	    }
    	    alias(name) {
    	        if (!this.aliases.has(name)) {
    	            this.aliases.set(name, this.get_unique_name(name));
    	        }
    	        return this.aliases.get(name);
    	    }
    	    child(options) {
    	        return new Block$1(Object.assign({}, this, { key: null }, options, { parent: this }));
    	    }
    	    get_contents(key) {
    	        const { dev } = this.renderer.options;
    	        if (this.has_outros) {
    	            this.add_variable({ type: 'Identifier', name: '#current' });
    	            if (this.chunks.intro.length > 0) {
    	                this.chunks.intro.push(b `#current = true;`);
    	                this.chunks.mount.push(b `#current = true;`);
    	            }
    	            if (this.chunks.outro.length > 0) {
    	                this.chunks.outro.push(b `#current = false;`);
    	            }
    	        }
    	        if (this.autofocus) {
    	            this.chunks.mount.push(b `${this.autofocus}.focus();`);
    	        }
    	        this.render_listeners();
    	        const properties = {};
    	        const noop = x `@noop`;
    	        properties.key = key;
    	        if (this.first) {
    	            properties.first = x `null`;
    	            this.chunks.hydrate.push(b `this.first = ${this.first};`);
    	        }
    	        if (this.chunks.create.length === 0 && this.chunks.hydrate.length === 0) {
    	            properties.create = noop;
    	        }
    	        else {
    	            const hydrate = this.chunks.hydrate.length > 0 && (this.renderer.options.hydratable
    	                ? b `this.h();`
    	                : this.chunks.hydrate);
    	            properties.create = x `function #create() {
				${this.chunks.create}
				${hydrate}
			}`;
    	        }
    	        if (this.renderer.options.hydratable || this.chunks.claim.length > 0) {
    	            if (this.chunks.claim.length === 0 && this.chunks.hydrate.length === 0) {
    	                properties.claim = noop;
    	            }
    	            else {
    	                properties.claim = x `function #claim(#nodes) {
					${this.chunks.claim}
					${this.renderer.options.hydratable && this.chunks.hydrate.length > 0 && b `this.h();`}
				}`;
    	            }
    	        }
    	        if (this.renderer.options.hydratable && this.chunks.hydrate.length > 0) {
    	            properties.hydrate = x `function #hydrate() {
				${this.chunks.hydrate}
			}`;
    	        }
    	        if (this.chunks.mount.length === 0) {
    	            properties.mount = noop;
    	        }
    	        else {
    	            properties.mount = x `function #mount(#target, anchor) {
				${this.chunks.mount}
			}`;
    	        }
    	        if (this.has_update_method || this.maintain_context) {
    	            if (this.chunks.update.length === 0 && !this.maintain_context) {
    	                properties.update = noop;
    	            }
    	            else {
    	                const ctx = this.maintain_context ? x `#new_ctx` : x `#ctx`;
    	                let dirty = { type: 'Identifier', name: '#dirty' };
    	                if (!this.renderer.context_overflow && !this.parent) {
    	                    dirty = { type: 'ArrayPattern', elements: [dirty] };
    	                }
    	                properties.update = x `function #update(${ctx}, ${dirty}) {
					${this.maintain_context && b `#ctx = ${ctx};`}
					${this.chunks.update}
				}`;
    	            }
    	        }
    	        if (this.has_animation) {
    	            properties.measure = x `function #measure() {
				${this.chunks.measure}
			}`;
    	            properties.fix = x `function #fix() {
				${this.chunks.fix}
			}`;
    	            properties.animate = x `function #animate() {
				${this.chunks.animate}
			}`;
    	        }
    	        if (this.has_intro_method || this.has_outro_method) {
    	            if (this.chunks.intro.length === 0) {
    	                properties.intro = noop;
    	            }
    	            else {
    	                properties.intro = x `function #intro(#local) {
					${this.has_outros && b `if (#current) return;`}
					${this.chunks.intro}
				}`;
    	            }
    	            if (this.chunks.outro.length === 0) {
    	                properties.outro = noop;
    	            }
    	            else {
    	                properties.outro = x `function #outro(#local) {
					${this.chunks.outro}
				}`;
    	            }
    	        }
    	        if (this.chunks.destroy.length === 0) {
    	            properties.destroy = noop;
    	        }
    	        else {
    	            properties.destroy = x `function #destroy(detaching) {
				${this.chunks.destroy}
			}`;
    	        }
    	        if (!this.renderer.component.compile_options.dev) {
    	            // allow shorthand names
    	            for (const name in properties) {
    	                const property = properties[name];
    	                if (property)
    	                    property.id = null;
    	            }
    	        }
    	        const return_value = x `{
			key: ${properties.key},
			first: ${properties.first},
			c: ${properties.create},
			l: ${properties.claim},
			h: ${properties.hydrate},
			m: ${properties.mount},
			p: ${properties.update},
			r: ${properties.measure},
			f: ${properties.fix},
			a: ${properties.animate},
			i: ${properties.intro},
			o: ${properties.outro},
			d: ${properties.destroy}
		}`;
    	        const block = dev && this.get_unique_name('block');
    	        const body = b `
			${Array.from(this.variables.values()).map(({ id, init }) => {
            return init
                ? b `let ${id} = ${init}`
                : b `let ${id}`;
        })}

			${this.chunks.init}

			${dev
            ? b `
					const ${block} = ${return_value};
					@dispatch_dev("SvelteRegisterBlock", {
						block: ${block},
						id: ${this.name || 'create_fragment'}.name,
						type: "${this.type}",
						source: "${this.comment ? this.comment.replace(/"/g, '\\"') : ''}",
						ctx: #ctx
					});
					return ${block};`
            : b `
					return ${return_value};`}
		`;
    	        return body;
    	    }
    	    has_content() {
    	        return this.renderer.options.dev ||
    	            this.first ||
    	            this.event_listeners.length > 0 ||
    	            this.chunks.intro.length > 0 ||
    	            this.chunks.outro.length > 0 ||
    	            this.chunks.create.length > 0 ||
    	            this.chunks.hydrate.length > 0 ||
    	            this.chunks.claim.length > 0 ||
    	            this.chunks.mount.length > 0 ||
    	            this.chunks.update.length > 0 ||
    	            this.chunks.destroy.length > 0 ||
    	            this.has_animation;
    	    }
    	    render() {
    	        const key = this.key && this.get_unique_name('key');
    	        const args = [x `#ctx`];
    	        if (key)
    	            args.unshift(key);
    	        const fn = b `function ${this.name}(${args}) {
			${this.get_contents(key)}
		}`;
    	        return this.comment
    	            ? b `
				// ${this.comment}
				${fn}`
    	            : fn;
    	    }
    	    render_listeners(chunk = '') {
    	        if (this.event_listeners.length > 0) {
    	            const dispose = {
    	                type: 'Identifier',
    	                name: `#dispose${chunk}`
    	            };
    	            this.add_variable(dispose);
    	            if (this.event_listeners.length === 1) {
    	                this.chunks.hydrate.push(b `${dispose} = ${this.event_listeners[0]};`);
    	                this.chunks.destroy.push(b `${dispose}();`);
    	            }
    	            else {
    	                this.chunks.hydrate.push(b `
					${dispose} = [
						${this.event_listeners}
					];
				`);
    	                this.chunks.destroy.push(b `@run_all(${dispose});`);
    	            }
    	        }
    	    }
    	}

    	class Wrapper {
    	    constructor(renderer, block, parent, node) {
    	        this.node = node;
    	        // make these non-enumerable so that they can be logged sensibly
    	        // (TODO in dev only?)
    	        Object.defineProperties(this, {
    	            renderer: {
    	                value: renderer
    	            },
    	            parent: {
    	                value: parent
    	            }
    	        });
    	        this.can_use_innerhtml = !renderer.options.hydratable;
    	        this.is_static_content = !renderer.options.hydratable;
    	        block.wrappers.push(this);
    	    }
    	    cannot_use_innerhtml() {
    	        this.can_use_innerhtml = false;
    	        if (this.parent)
    	            this.parent.cannot_use_innerhtml();
    	    }
    	    not_static_content() {
    	        this.is_static_content = false;
    	        if (this.parent)
    	            this.parent.not_static_content();
    	    }
    	    get_or_create_anchor(block, parent_node, parent_nodes) {
    	        // TODO use this in EachBlock and IfBlock — tricky because
    	        // children need to be created first
    	        const needs_anchor = this.next ? !this.next.is_dom_node() : !parent_node || !this.parent.is_dom_node();
    	        const anchor = needs_anchor
    	            ? block.get_unique_name(`${this.var.name}_anchor`)
    	            : (this.next && this.next.var) || { type: 'Identifier', name: 'null' };
    	        if (needs_anchor) {
    	            block.add_element(anchor, x `@empty()`, parent_nodes && x `@empty()`, parent_node);
    	        }
    	        return anchor;
    	    }
    	    get_update_mount_node(anchor) {
    	        return ((this.parent && this.parent.is_dom_node())
    	            ? this.parent.var
    	            : x `${anchor}.parentNode`);
    	    }
    	    is_dom_node() {
    	        return (this.node.type === 'Element' ||
    	            this.node.type === 'Text' ||
    	            this.node.type === 'MustacheTag');
    	    }
    	    render(_block, _parent_node, _parent_nodes) {
    	        throw Error('Wrapper class is not renderable');
    	    }
    	}

    	function create_debugging_comment(node, component) {
    	    const { locate, source } = component;
    	    let c = node.start;
    	    if (node.type === 'ElseBlock') {
    	        while (source[c - 1] !== '{')
    	            c -= 1;
    	        while (source[c - 1] === '{')
    	            c -= 1;
    	    }
    	    let d;
    	    if (node.type === 'InlineComponent' || node.type === 'Element') {
    	        d = node.children.length ? node.children[0].start : node.start;
    	        while (source[d - 1] !== '>')
    	            d -= 1;
    	    }
    	    else {
    	        // @ts-ignore
    	        d = node.expression ? node.expression.node.end : c;
    	        while (source[d] !== '}')
    	            d += 1;
    	        while (source[d] === '}')
    	            d += 1;
    	    }
    	    const start = locate(c);
    	    const loc = `(${start.line}:${start.column})`;
    	    return `${loc} ${source.slice(c, d)}`.replace(/\s/g, ' ');
    	}

    	class AwaitBlockBranch extends Wrapper {
    	    constructor(status, renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = null;
    	        this.block = block.child({
    	            comment: create_debugging_comment(node, this.renderer.component),
    	            name: this.renderer.component.get_unique_name(`create_${status}_block`),
    	            type: status
    	        });
    	        this.fragment = new FragmentWrapper(renderer, this.block, this.node.children, parent, strip_whitespace, next_sibling);
    	        this.is_dynamic = this.block.dependencies.size > 0;
    	    }
    	}
    	class AwaitBlockWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = { type: 'Identifier', name: 'await_block' };
    	        this.cannot_use_innerhtml();
    	        this.not_static_content();
    	        block.add_dependencies(this.node.expression.dependencies);
    	        let is_dynamic = false;
    	        let has_intros = false;
    	        let has_outros = false;
    	        ['pending', 'then', 'catch'].forEach(status => {
    	            const child = this.node[status];
    	            const branch = new AwaitBlockBranch(status, renderer, block, this, child, strip_whitespace, next_sibling);
    	            renderer.blocks.push(branch.block);
    	            if (branch.is_dynamic) {
    	                is_dynamic = true;
    	                // TODO should blocks update their own parents?
    	                block.add_dependencies(branch.block.dependencies);
    	            }
    	            if (branch.block.has_intros)
    	                has_intros = true;
    	            if (branch.block.has_outros)
    	                has_outros = true;
    	            this[status] = branch;
    	        });
    	        this.pending.block.has_update_method = is_dynamic;
    	        this.then.block.has_update_method = is_dynamic;
    	        this.catch.block.has_update_method = is_dynamic;
    	        this.pending.block.has_intro_method = has_intros;
    	        this.then.block.has_intro_method = has_intros;
    	        this.catch.block.has_intro_method = has_intros;
    	        this.pending.block.has_outro_method = has_outros;
    	        this.then.block.has_outro_method = has_outros;
    	        this.catch.block.has_outro_method = has_outros;
    	        if (has_outros) {
    	            block.add_outro();
    	        }
    	        if (this.node.value)
    	            block.renderer.add_to_context(this.node.value, true);
    	        if (this.node.error)
    	            block.renderer.add_to_context(this.node.error, true);
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        const anchor = this.get_or_create_anchor(block, parent_node, parent_nodes);
    	        const update_mount_node = this.get_update_mount_node(anchor);
    	        const snippet = this.node.expression.manipulate(block);
    	        const info = block.get_unique_name(`info`);
    	        const promise = block.get_unique_name(`promise`);
    	        block.add_variable(promise);
    	        block.maintain_context = true;
    	        const value_index = this.node.value && block.renderer.context_lookup.get(this.node.value).index;
    	        const error_index = this.node.error && block.renderer.context_lookup.get(this.node.error).index;
    	        const info_props = x `{
			ctx: #ctx,
			current: null,
			token: null,
			pending: ${this.pending.block.name},
			then: ${this.then.block.name},
			catch: ${this.catch.block.name},
			value: ${value_index},
			error: ${error_index},
			blocks: ${this.pending.block.has_outro_method && x `[,,,]`}
		}`;
    	        block.chunks.init.push(b `
			let ${info} = ${info_props};
		`);
    	        block.chunks.init.push(b `
			@handle_promise(${promise} = ${snippet}, ${info});
		`);
    	        block.chunks.create.push(b `
			${info}.block.c();
		`);
    	        if (parent_nodes && this.renderer.options.hydratable) {
    	            block.chunks.claim.push(b `
				${info}.block.l(${parent_nodes});
			`);
    	        }
    	        const initial_mount_node = parent_node || '#target';
    	        const anchor_node = parent_node ? 'null' : 'anchor';
    	        const has_transitions = this.pending.block.has_intro_method || this.pending.block.has_outro_method;
    	        block.chunks.mount.push(b `
			${info}.block.m(${initial_mount_node}, ${info}.anchor = ${anchor_node});
			${info}.mount = () => ${update_mount_node};
			${info}.anchor = ${anchor};
		`);
    	        if (has_transitions) {
    	            block.chunks.intro.push(b `@transition_in(${info}.block);`);
    	        }
    	        const dependencies = this.node.expression.dynamic_dependencies();
    	        if (dependencies.length > 0) {
    	            const condition = x `
				${block.renderer.dirty(dependencies)} &&
				${promise} !== (${promise} = ${snippet}) &&
				@handle_promise(${promise}, ${info})`;
    	            block.chunks.update.push(b `${info}.ctx = #ctx;`);
    	            if (this.pending.block.has_update_method) {
    	                block.chunks.update.push(b `
					if (${condition}) {

					} else {
						const #child_ctx = #ctx.slice();
						#child_ctx[${value_index}] = ${info}.resolved;
						${info}.block.p(#child_ctx, #dirty);
					}
				`);
    	            }
    	            else {
    	                block.chunks.update.push(b `
					${condition}
				`);
    	            }
    	        }
    	        else {
    	            if (this.pending.block.has_update_method) {
    	                block.chunks.update.push(b `
					{
						const #child_ctx = #ctx.slice();
						#child_ctx[${value_index}] = ${info}.resolved;
						${info}.block.p(#child_ctx, #dirty);
					}
				`);
    	            }
    	        }
    	        if (this.pending.block.has_outro_method) {
    	            block.chunks.outro.push(b `
				for (let #i = 0; #i < 3; #i += 1) {
					const block = ${info}.blocks[#i];
					@transition_out(block);
				}
			`);
    	        }
    	        block.chunks.destroy.push(b `
			${info}.block.d(${parent_node ? null : 'detaching'});
			${info}.token = null;
			${info} = null;
		`);
    	        [this.pending, this.then, this.catch].forEach(branch => {
    	            branch.fragment.render(branch.block, null, x `#nodes`);
    	        });
    	    }
    	}

    	const TRUE = x `true`;
    	const FALSE = x `false`;
    	class EventHandlerWrapper {
    	    constructor(node, parent) {
    	        this.node = node;
    	        this.parent = parent;
    	        if (!node.expression) {
    	            this.parent.renderer.add_to_context(node.handler_name.name);
    	            this.parent.renderer.component.partly_hoisted.push(b `
				function ${node.handler_name.name}(event) {
					@bubble($$self, event);
				}
			`);
    	        }
    	    }
    	    get_snippet(block) {
    	        const snippet = this.node.expression ? this.node.expression.manipulate(block) : block.renderer.reference(this.node.handler_name);
    	        if (this.node.reassigned) {
    	            block.maintain_context = true;
    	            return x `function () { ${snippet}.apply(this, arguments); }`;
    	        }
    	        return snippet;
    	    }
    	    render(block, target) {
    	        let snippet = this.get_snippet(block);
    	        if (this.node.modifiers.has('preventDefault'))
    	            snippet = x `@prevent_default(${snippet})`;
    	        if (this.node.modifiers.has('stopPropagation'))
    	            snippet = x `@stop_propagation(${snippet})`;
    	        if (this.node.modifiers.has('self'))
    	            snippet = x `@self(${snippet})`;
    	        const args = [];
    	        const opts = ['passive', 'once', 'capture'].filter(mod => this.node.modifiers.has(mod));
    	        if (opts.length) {
    	            args.push((opts.length === 1 && opts[0] === 'capture')
    	                ? TRUE
    	                : x `{ ${opts.map(opt => p `${opt}: true`)} }`);
    	        }
    	        else if (block.renderer.options.dev) {
    	            args.push(FALSE);
    	        }
    	        if (block.renderer.options.dev) {
    	            args.push(this.node.modifiers.has('preventDefault') ? TRUE : FALSE);
    	            args.push(this.node.modifiers.has('stopPropagation') ? TRUE : FALSE);
    	        }
    	        block.event_listeners.push(x `@listen(${target}, "${this.node.name}", ${snippet}, ${args})`);
    	    }
    	}

    	class BodyWrapper extends Wrapper {
    	    render(block, _parent_node, _parent_nodes) {
    	        this.node.handlers
    	            .map(handler => new EventHandlerWrapper(handler, this))
    	            .forEach(handler => {
    	            const snippet = handler.get_snippet(block);
    	            block.chunks.init.push(b `
					@_document.body.addEventListener("${handler.node.name}", ${snippet});
				`);
    	            block.chunks.destroy.push(b `
					@_document.body.removeEventListener("${handler.node.name}", ${snippet});
				`);
    	        });
    	    }
    	}

    	function add_to_set(a, b) {
    	    // @ts-ignore
    	    b.forEach(item => {
    	        a.add(item);
    	    });
    	}

    	class DebugTagWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, _strip_whitespace, _next_sibling) {
    	        super(renderer, block, parent, node);
    	    }
    	    render(block, _parent_node, _parent_nodes) {
    	        const { renderer } = this;
    	        const { component } = renderer;
    	        if (!renderer.options.dev)
    	            return;
    	        const { var_lookup } = component;
    	        const start = component.locate(this.node.start + 1);
    	        const end = { line: start.line, column: start.column + 6 };
    	        const loc = { start, end };
    	        const debug = {
    	            type: 'DebuggerStatement',
    	            loc
    	        };
    	        if (this.node.expressions.length === 0) {
    	            // Debug all
    	            block.chunks.create.push(debug);
    	            block.chunks.update.push(debug);
    	        }
    	        else {
    	            const log = {
    	                type: 'Identifier',
    	                name: 'log',
    	                loc
    	            };
    	            const dependencies = new Set();
    	            this.node.expressions.forEach(expression => {
    	                add_to_set(dependencies, expression.dependencies);
    	            });
    	            const contextual_identifiers = this.node.expressions
    	                .filter(e => {
    	                const variable = var_lookup.get(e.node.name);
    	                return !(variable && variable.hoistable);
    	            })
    	                .map(e => e.node.name);
    	            const logged_identifiers = this.node.expressions.map(e => p `${e.node.name}`);
    	            const debug_statements = b `
				${contextual_identifiers.map(name => b `const ${name} = ${renderer.reference(name)};`)}
				@_console.${log}({ ${logged_identifiers} });
				debugger;`;
    	            if (dependencies.size) {
    	                const condition = renderer.dirty(Array.from(dependencies));
    	                block.chunks.update.push(b `
					if (${condition}) {
						${debug_statements}
					}
				`);
    	            }
    	            block.chunks.create.push(b `{
				${debug_statements}
			}`);
    	        }
    	    }
    	}

    	class ElseBlockWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = null;
    	        this.block = block.child({
    	            comment: create_debugging_comment(node, this.renderer.component),
    	            name: this.renderer.component.get_unique_name(`create_else_block`),
    	            type: 'else'
    	        });
    	        this.fragment = new FragmentWrapper(renderer, this.block, this.node.children, parent, strip_whitespace, next_sibling);
    	        this.is_dynamic = this.block.dependencies.size > 0;
    	    }
    	}
    	class EachBlockWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = { type: 'Identifier', name: 'each' };
    	        this.cannot_use_innerhtml();
    	        this.not_static_content();
    	        const { dependencies } = node.expression;
    	        block.add_dependencies(dependencies);
    	        this.node.contexts.forEach(context => {
    	            renderer.add_to_context(context.key.name, true);
    	        });
    	        this.block = block.child({
    	            comment: create_debugging_comment(this.node, this.renderer.component),
    	            name: renderer.component.get_unique_name('create_each_block'),
    	            type: 'each',
    	            // @ts-ignore todo: probably error
    	            key: node.key,
    	            bindings: new Map(block.bindings)
    	        });
    	        // TODO this seems messy
    	        this.block.has_animation = this.node.has_animation;
    	        this.index_name = this.node.index
    	            ? { type: 'Identifier', name: this.node.index }
    	            : renderer.component.get_unique_name(`${this.node.context}_index`);
    	        const fixed_length = node.expression.node.type === 'ArrayExpression' &&
    	            node.expression.node.elements.every(element => element.type !== 'SpreadElement')
    	            ? node.expression.node.elements.length
    	            : null;
    	        // hack the sourcemap, so that if data is missing the bug
    	        // is easy to find
    	        let c = this.node.start + 2;
    	        while (renderer.component.source[c] !== 'e')
    	            c += 1;
    	        const start = renderer.component.locate(c);
    	        const end = { line: start.line, column: start.column + 4 };
    	        const length = {
    	            type: 'Identifier',
    	            name: 'length',
    	            loc: { start, end }
    	        };
    	        const each_block_value = renderer.component.get_unique_name(`${this.var.name}_value`);
    	        const iterations = block.get_unique_name(`${this.var.name}_blocks`);
    	        renderer.add_to_context(each_block_value.name, true);
    	        renderer.add_to_context(this.index_name.name, true);
    	        this.vars = {
    	            create_each_block: this.block.name,
    	            each_block_value,
    	            get_each_context: renderer.component.get_unique_name(`get_${this.var.name}_context`),
    	            iterations,
    	            // optimisation for array literal
    	            fixed_length,
    	            data_length: fixed_length === null ? x `${each_block_value}.${length}` : fixed_length,
    	            view_length: fixed_length === null ? x `${iterations}.length` : fixed_length
    	        };
    	        const store = node.expression.node.type === 'Identifier' &&
    	            node.expression.node.name[0] === '$'
    	            ? node.expression.node.name.slice(1)
    	            : null;
    	        node.contexts.forEach(prop => {
    	            this.block.bindings.set(prop.key.name, {
    	                object: this.vars.each_block_value,
    	                property: this.index_name,
    	                modifier: prop.modifier,
    	                snippet: prop.modifier(x `${this.vars.each_block_value}[${this.index_name}]`),
    	                store,
    	                tail: prop.modifier(x `[${this.index_name}]`)
    	            });
    	        });
    	        if (this.node.index) {
    	            this.block.get_unique_name(this.node.index); // this prevents name collisions (#1254)
    	        }
    	        renderer.blocks.push(this.block);
    	        this.fragment = new FragmentWrapper(renderer, this.block, node.children, this, strip_whitespace, next_sibling);
    	        if (this.node.else) {
    	            this.else = new ElseBlockWrapper(renderer, block, this, this.node.else, strip_whitespace, next_sibling);
    	            renderer.blocks.push(this.else.block);
    	            if (this.else.is_dynamic) {
    	                this.block.add_dependencies(this.else.block.dependencies);
    	            }
    	        }
    	        block.add_dependencies(this.block.dependencies);
    	        if (this.block.has_outros || (this.else && this.else.block.has_outros)) {
    	            block.add_outro();
    	        }
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        if (this.fragment.nodes.length === 0)
    	            return;
    	        const { renderer } = this;
    	        const { component } = renderer;
    	        const needs_anchor = this.next
    	            ? !this.next.is_dom_node() :
    	            !parent_node || !this.parent.is_dom_node();
    	        this.context_props = this.node.contexts.map(prop => b `child_ctx[${renderer.context_lookup.get(prop.key.name).index}] = ${prop.modifier(x `list[i]`)};`);
    	        if (this.node.has_binding)
    	            this.context_props.push(b `child_ctx[${renderer.context_lookup.get(this.vars.each_block_value.name).index}] = list;`);
    	        if (this.node.has_binding || this.node.index)
    	            this.context_props.push(b `child_ctx[${renderer.context_lookup.get(this.index_name.name).index}] = i;`);
    	        const snippet = this.node.expression.manipulate(block);
    	        block.chunks.init.push(b `let ${this.vars.each_block_value} = ${snippet};`);
    	        // TODO which is better — Object.create(array) or array.slice()?
    	        renderer.blocks.push(b `
			function ${this.vars.get_each_context}(#ctx, list, i) {
				const child_ctx = #ctx.slice();
				${this.context_props}
				return child_ctx;
			}
		`);
    	        const initial_anchor_node = { type: 'Identifier', name: parent_node ? 'null' : 'anchor' };
    	        const initial_mount_node = parent_node || { type: 'Identifier', name: '#target' };
    	        const update_anchor_node = needs_anchor
    	            ? block.get_unique_name(`${this.var.name}_anchor`)
    	            : (this.next && this.next.var) || { type: 'Identifier', name: 'null' };
    	        const update_mount_node = this.get_update_mount_node(update_anchor_node);
    	        const args = {
    	            block,
    	            parent_node,
    	            parent_nodes,
    	            snippet,
    	            initial_anchor_node,
    	            initial_mount_node,
    	            update_anchor_node,
    	            update_mount_node
    	        };
    	        if (this.node.key) {
    	            this.render_keyed(args);
    	        }
    	        else {
    	            this.render_unkeyed(args);
    	        }
    	        if (this.block.has_intro_method || this.block.has_outro_method) {
    	            block.chunks.intro.push(b `
				for (let #i = 0; #i < ${this.vars.data_length}; #i += 1) {
					@transition_in(${this.vars.iterations}[#i]);
				}
			`);
    	        }
    	        if (needs_anchor) {
    	            block.add_element(update_anchor_node, x `@empty()`, parent_nodes && x `@empty()`, parent_node);
    	        }
    	        if (this.else) {
    	            const each_block_else = component.get_unique_name(`${this.var.name}_else`);
    	            block.chunks.init.push(b `let ${each_block_else} = null;`);
    	            // TODO neaten this up... will end up with an empty line in the block
    	            block.chunks.init.push(b `
				if (!${this.vars.data_length}) {
					${each_block_else} = ${this.else.block.name}(#ctx);
					${each_block_else}.c();
				}
			`);
    	            block.chunks.mount.push(b `
				if (${each_block_else}) {
					${each_block_else}.m(${initial_mount_node}, ${initial_anchor_node});
				}
			`);
    	            if (this.else.block.has_update_method) {
    	                block.chunks.update.push(b `
					if (!${this.vars.data_length} && ${each_block_else}) {
						${each_block_else}.p(#ctx, #dirty);
					} else if (!${this.vars.data_length}) {
						${each_block_else} = ${this.else.block.name}(#ctx);
						${each_block_else}.c();
						${each_block_else}.m(${update_mount_node}, ${update_anchor_node});
					} else if (${each_block_else}) {
						${each_block_else}.d(1);
						${each_block_else} = null;
					}
				`);
    	            }
    	            else {
    	                block.chunks.update.push(b `
					if (${this.vars.data_length}) {
						if (${each_block_else}) {
							${each_block_else}.d(1);
							${each_block_else} = null;
						}
					} else if (!${each_block_else}) {
						${each_block_else} = ${this.else.block.name}(#ctx);
						${each_block_else}.c();
						${each_block_else}.m(${update_mount_node}, ${update_anchor_node});
					}
				`);
    	            }
    	            block.chunks.destroy.push(b `
				if (${each_block_else}) ${each_block_else}.d(${parent_node ? '' : 'detaching'});
			`);
    	        }
    	        this.fragment.render(this.block, null, x `#nodes`);
    	        if (this.else) {
    	            this.else.fragment.render(this.else.block, null, x `#nodes`);
    	        }
    	    }
    	    render_keyed({ block, parent_node, parent_nodes, snippet, initial_anchor_node, initial_mount_node, update_anchor_node, update_mount_node }) {
    	        const { create_each_block, iterations, data_length, view_length } = this.vars;
    	        const get_key = block.get_unique_name('get_key');
    	        const lookup = block.get_unique_name(`${this.var.name}_lookup`);
    	        block.add_variable(iterations, x `[]`);
    	        block.add_variable(lookup, x `new @_Map()`);
    	        if (this.fragment.nodes[0].is_dom_node()) {
    	            this.block.first = this.fragment.nodes[0].var;
    	        }
    	        else {
    	            this.block.first = this.block.get_unique_name('first');
    	            this.block.add_element(this.block.first, x `@empty()`, parent_nodes && x `@empty()`, null);
    	        }
    	        block.chunks.init.push(b `
			const ${get_key} = #ctx => ${this.node.key.manipulate(block)};

			for (let #i = 0; #i < ${data_length}; #i += 1) {
				let child_ctx = ${this.vars.get_each_context}(#ctx, ${this.vars.each_block_value}, #i);
				let key = ${get_key}(child_ctx);
				${lookup}.set(key, ${iterations}[#i] = ${create_each_block}(key, child_ctx));
			}
		`);
    	        block.chunks.create.push(b `
			for (let #i = 0; #i < ${view_length}; #i += 1) {
				${iterations}[#i].c();
			}
		`);
    	        if (parent_nodes && this.renderer.options.hydratable) {
    	            block.chunks.claim.push(b `
				for (let #i = 0; #i < ${view_length}; #i += 1) {
					${iterations}[#i].l(${parent_nodes});
				}
			`);
    	        }
    	        block.chunks.mount.push(b `
			for (let #i = 0; #i < ${view_length}; #i += 1) {
				${iterations}[#i].m(${initial_mount_node}, ${initial_anchor_node});
			}
		`);
    	        const dynamic = this.block.has_update_method;
    	        const destroy = this.node.has_animation
    	            ? (this.block.has_outros
    	                ? `@fix_and_outro_and_destroy_block`
    	                : `@fix_and_destroy_block`)
    	            : this.block.has_outros
    	                ? `@outro_and_destroy_block`
    	                : `@destroy_block`;
    	        block.chunks.update.push(b `
			const ${this.vars.each_block_value} = ${snippet};

			${this.block.has_outros && b `@group_outros();`}
			${this.node.has_animation && b `for (let #i = 0; #i < ${view_length}; #i += 1) ${iterations}[#i].r();`}
			${iterations} = @update_keyed_each(${iterations}, #dirty, ${get_key}, ${dynamic ? 1 : 0}, #ctx, ${this.vars.each_block_value}, ${lookup}, ${update_mount_node}, ${destroy}, ${create_each_block}, ${update_anchor_node}, ${this.vars.get_each_context});
			${this.node.has_animation && b `for (let #i = 0; #i < ${view_length}; #i += 1) ${iterations}[#i].a();`}
			${this.block.has_outros && b `@check_outros();`}
		`);
    	        if (this.block.has_outros) {
    	            block.chunks.outro.push(b `
				for (let #i = 0; #i < ${view_length}; #i += 1) {
					@transition_out(${iterations}[#i]);
				}
			`);
    	        }
    	        block.chunks.destroy.push(b `
			for (let #i = 0; #i < ${view_length}; #i += 1) {
				${iterations}[#i].d(${parent_node ? null : 'detaching'});
			}
		`);
    	    }
    	    render_unkeyed({ block, parent_nodes, snippet, initial_anchor_node, initial_mount_node, update_anchor_node, update_mount_node }) {
    	        const { create_each_block, iterations, fixed_length, data_length, view_length } = this.vars;
    	        block.chunks.init.push(b `
			let ${iterations} = [];

			for (let #i = 0; #i < ${data_length}; #i += 1) {
				${iterations}[#i] = ${create_each_block}(${this.vars.get_each_context}(#ctx, ${this.vars.each_block_value}, #i));
			}
		`);
    	        block.chunks.create.push(b `
			for (let #i = 0; #i < ${view_length}; #i += 1) {
				${iterations}[#i].c();
			}
		`);
    	        if (parent_nodes && this.renderer.options.hydratable) {
    	            block.chunks.claim.push(b `
				for (let #i = 0; #i < ${view_length}; #i += 1) {
					${iterations}[#i].l(${parent_nodes});
				}
			`);
    	        }
    	        block.chunks.mount.push(b `
			for (let #i = 0; #i < ${view_length}; #i += 1) {
				${iterations}[#i].m(${initial_mount_node}, ${initial_anchor_node});
			}
		`);
    	        const all_dependencies = new Set(this.block.dependencies); // TODO should be dynamic deps only
    	        this.node.expression.dynamic_dependencies().forEach((dependency) => {
    	            all_dependencies.add(dependency);
    	        });
    	        if (all_dependencies.size) {
    	            const has_transitions = !!(this.block.has_intro_method || this.block.has_outro_method);
    	            const for_loop_body = this.block.has_update_method
    	                ? b `
					if (${iterations}[#i]) {
						${iterations}[#i].p(child_ctx, #dirty);
						${has_transitions && b `@transition_in(${this.vars.iterations}[#i], 1);`}
					} else {
						${iterations}[#i] = ${create_each_block}(child_ctx);
						${iterations}[#i].c();
						${has_transitions && b `@transition_in(${this.vars.iterations}[#i], 1);`}
						${iterations}[#i].m(${update_mount_node}, ${update_anchor_node});
					}
				`
    	                : has_transitions
    	                    ? b `
						if (${iterations}[#i]) {
							@transition_in(${this.vars.iterations}[#i], 1);
						} else {
							${iterations}[#i] = ${create_each_block}(child_ctx);
							${iterations}[#i].c();
							@transition_in(${this.vars.iterations}[#i], 1);
							${iterations}[#i].m(${update_mount_node}, ${update_anchor_node});
						}
					`
    	                    : b `
						if (!${iterations}[#i]) {
							${iterations}[#i] = ${create_each_block}(child_ctx);
							${iterations}[#i].c();
							${iterations}[#i].m(${update_mount_node}, ${update_anchor_node});
						}
					`;
    	            const start = this.block.has_update_method ? 0 : `#old_length`;
    	            let remove_old_blocks;
    	            if (this.block.has_outros) {
    	                const out = block.get_unique_name('out');
    	                block.chunks.init.push(b `
					const ${out} = i => @transition_out(${iterations}[i], 1, 1, () => {
						${iterations}[i] = null;
					});
				`);
    	                remove_old_blocks = b `
					@group_outros();
					for (#i = ${data_length}; #i < ${view_length}; #i += 1) {
						${out}(#i);
					}
					@check_outros();
				`;
    	            }
    	            else {
    	                remove_old_blocks = b `
					for (${this.block.has_update_method ? null : x `#i = ${data_length}`}; #i < ${this.block.has_update_method ? view_length : '#old_length'}; #i += 1) {
						${iterations}[#i].d(1);
					}
					${!fixed_length && b `${view_length} = ${data_length};`}
				`;
    	            }
    	            // We declare `i` as block scoped here, as the `remove_old_blocks` code
    	            // may rely on continuing where this iteration stopped.
    	            const update = b `
				${!this.block.has_update_method && b `const #old_length = ${this.vars.each_block_value}.length;`}
				${this.vars.each_block_value} = ${snippet};

				let #i;
				for (#i = ${start}; #i < ${data_length}; #i += 1) {
					const child_ctx = ${this.vars.get_each_context}(#ctx, ${this.vars.each_block_value}, #i);

					${for_loop_body}
				}

				${remove_old_blocks}
			`;
    	            block.chunks.update.push(b `
				if (${block.renderer.dirty(Array.from(all_dependencies))}) {
					${update}
				}
			`);
    	        }
    	        if (this.block.has_outros) {
    	            block.chunks.outro.push(b `
				${iterations} = ${iterations}.filter(@_Boolean);
				for (let #i = 0; #i < ${view_length}; #i += 1) {
					@transition_out(${iterations}[#i]);
				}
			`);
    	        }
    	        block.chunks.destroy.push(b `@destroy_each(${iterations}, detaching);`);
    	    }
    	}

    	function string_literal(data) {
    	    return {
    	        type: 'Literal',
    	        value: data
    	    };
    	}
    	const escaped = {
    	    '"': '&quot;',
    	    "'": '&#39;',
    	    '&': '&amp;',
    	    '<': '&lt;',
    	    '>': '&gt;',
    	};
    	function escape_html(html) {
    	    return String(html).replace(/["'&<>]/g, match => escaped[match]);
    	}
    	function escape_template(str) {
    	    return str.replace(/(\${|`|\\)/g, '\\$1');
    	}

    	const svg_attributes = 'accent-height accumulate additive alignment-baseline allowReorder alphabetic amplitude arabic-form ascent attributeName attributeType autoReverse azimuth baseFrequency baseline-shift baseProfile bbox begin bias by calcMode cap-height class clip clipPathUnits clip-path clip-rule color color-interpolation color-interpolation-filters color-profile color-rendering contentScriptType contentStyleType cursor cx cy d decelerate descent diffuseConstant direction display divisor dominant-baseline dur dx dy edgeMode elevation enable-background end exponent externalResourcesRequired fill fill-opacity fill-rule filter filterRes filterUnits flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight format from fr fx fy g1 g2 glyph-name glyph-orientation-horizontal glyph-orientation-vertical glyphRef gradientTransform gradientUnits hanging height href horiz-adv-x horiz-origin-x id ideographic image-rendering in in2 intercept k k1 k2 k3 k4 kernelMatrix kernelUnitLength kerning keyPoints keySplines keyTimes lang lengthAdjust letter-spacing lighting-color limitingConeAngle local marker-end marker-mid marker-start markerHeight markerUnits markerWidth mask maskContentUnits maskUnits mathematical max media method min mode name numOctaves offset onabort onactivate onbegin onclick onend onerror onfocusin onfocusout onload onmousedown onmousemove onmouseout onmouseover onmouseup onrepeat onresize onscroll onunload opacity operator order orient orientation origin overflow overline-position overline-thickness panose-1 paint-order pathLength patternContentUnits patternTransform patternUnits pointer-events points pointsAtX pointsAtY pointsAtZ preserveAlpha preserveAspectRatio primitiveUnits r radius refX refY rendering-intent repeatCount repeatDur requiredExtensions requiredFeatures restart result rotate rx ry scale seed shape-rendering slope spacing specularConstant specularExponent speed spreadMethod startOffset stdDeviation stemh stemv stitchTiles stop-color stop-opacity strikethrough-position strikethrough-thickness string stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width style surfaceScale systemLanguage tabindex tableValues target targetX targetY text-anchor text-decoration text-rendering textLength to transform type u1 u2 underline-position underline-thickness unicode unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical values version vert-adv-y vert-origin-x vert-origin-y viewBox viewTarget visibility width widths word-spacing writing-mode x x-height x1 x2 xChannelSelector xlink:actuate xlink:arcrole xlink:href xlink:role xlink:show xlink:title xlink:type xml:base xml:lang xml:space y y1 y2 yChannelSelector z zoomAndPan'.split(' ');
    	const svg_attribute_lookup = new Map();
    	svg_attributes.forEach(name => {
    	    svg_attribute_lookup.set(name.toLowerCase(), name);
    	});
    	function fix_attribute_casing(name) {
    	    name = name.toLowerCase();
    	    return svg_attribute_lookup.get(name) || name;
    	}

    	const html = 'http://www.w3.org/1999/xhtml';
    	const mathml = 'http://www.w3.org/1998/Math/MathML';
    	const svg = 'http://www.w3.org/2000/svg';
    	const xlink = 'http://www.w3.org/1999/xlink';
    	const xml = 'http://www.w3.org/XML/1998/namespace';
    	const xmlns = 'http://www.w3.org/2000/xmlns';
    	const valid_namespaces = [
    	    'html',
    	    'mathml',
    	    'svg',
    	    'xlink',
    	    'xml',
    	    'xmlns',
    	    html,
    	    mathml,
    	    svg,
    	    xlink,
    	    xml,
    	    xmlns,
    	];
    	const namespaces = { html, mathml, svg, xlink, xml, xmlns };

    	class AttributeWrapper {
    	    constructor(parent, block, node) {
    	        this.node = node;
    	        this.parent = parent;
    	        if (node.dependencies.size > 0) {
    	            parent.cannot_use_innerhtml();
    	            parent.not_static_content();
    	            block.add_dependencies(node.dependencies);
    	            // special case — <option value={foo}> — see below
    	            if (this.parent.node.name === 'option' && node.name === 'value') {
    	                let select = this.parent;
    	                while (select && (select.node.type !== 'Element' || select.node.name !== 'select'))
    	                    // @ts-ignore todo: doublecheck this, but looks to be correct
    	                    select = select.parent;
    	                if (select && select.select_binding_dependencies) {
    	                    select.select_binding_dependencies.forEach(prop => {
    	                        this.node.dependencies.forEach((dependency) => {
    	                            this.parent.renderer.component.indirect_dependencies.get(prop).add(dependency);
    	                        });
    	                    });
    	                }
    	            }
    	        }
    	    }
    	    render(block) {
    	        const element = this.parent;
    	        const name = fix_attribute_casing(this.node.name);
    	        const metadata = this.get_metadata();
    	        const is_indirectly_bound_value = name === 'value' &&
    	            (element.node.name === 'option' || // TODO check it's actually bound
    	                (element.node.name === 'input' &&
    	                    element.node.bindings.find((binding) => /checked|group/.test(binding.name))));
    	        const property_name = is_indirectly_bound_value
    	            ? '__value'
    	            : metadata && metadata.property_name;
    	        // xlink is a special case... we could maybe extend this to generic
    	        // namespaced attributes but I'm not sure that's applicable in
    	        // HTML5?
    	        const method = /-/.test(element.node.name)
    	            ? '@set_custom_element_data'
    	            : name.slice(0, 6) === 'xlink:'
    	                ? '@xlink_attr'
    	                : '@attr';
    	        const is_legacy_input_type = element.renderer.component.compile_options.legacy && name === 'type' && this.parent.node.name === 'input';
    	        const dependencies = this.node.get_dependencies();
    	        const value = this.get_value(block);
    	        const is_src = this.node.name === 'src'; // TODO retire this exception in favour of https://github.com/sveltejs/svelte/issues/3750
    	        const is_select_value_attribute = name === 'value' && element.node.name === 'select';
    	        const should_cache = is_src || this.node.should_cache() || is_select_value_attribute; // TODO is this necessary?
    	        const last = should_cache && block.get_unique_name(`${element.var.name}_${name.replace(/[^a-zA-Z_$]/g, '_')}_value`);
    	        if (should_cache)
    	            block.add_variable(last);
    	        let updater;
    	        const init = should_cache ? x `${last} = ${value}` : value;
    	        if (is_legacy_input_type) {
    	            block.chunks.hydrate.push(b `@set_input_type(${element.var}, ${init});`);
    	            updater = b `@set_input_type(${element.var}, ${should_cache ? last : value});`;
    	        }
    	        else if (is_select_value_attribute) {
    	            // annoying special case
    	            const is_multiple_select = element.node.get_static_attribute_value('multiple');
    	            const i = block.get_unique_name('i');
    	            const option = block.get_unique_name('option');
    	            const if_statement = is_multiple_select
    	                ? b `
					${option}.selected = ~${last}.indexOf(${option}.__value);`
    	                : b `
					if (${option}.__value === ${last}) {
						${option}.selected = true;
						${{ type: 'BreakStatement' }};
					}`; // TODO the BreakStatement is gross, but it's unsyntactic otherwise...
    	            updater = b `
				for (var ${i} = 0; ${i} < ${element.var}.options.length; ${i} += 1) {
					var ${option} = ${element.var}.options[${i}];

					${if_statement}
				}
			`;
    	            block.chunks.mount.push(b `
				${last} = ${value};
				${updater}
			`);
    	        }
    	        else if (is_src) {
    	            block.chunks.hydrate.push(b `if (${element.var}.src !== ${init}) ${method}(${element.var}, "${name}", ${last});`);
    	            updater = b `${method}(${element.var}, "${name}", ${should_cache ? last : value});`;
    	        }
    	        else if (property_name) {
    	            block.chunks.hydrate.push(b `${element.var}.${property_name} = ${init};`);
    	            updater = block.renderer.options.dev
    	                ? b `@prop_dev(${element.var}, "${property_name}", ${should_cache ? last : value});`
    	                : b `${element.var}.${property_name} = ${should_cache ? last : value};`;
    	        }
    	        else {
    	            block.chunks.hydrate.push(b `${method}(${element.var}, "${name}", ${init});`);
    	            updater = b `${method}(${element.var}, "${name}", ${should_cache ? last : value});`;
    	        }
    	        if (dependencies.length > 0) {
    	            let condition = block.renderer.dirty(dependencies);
    	            if (should_cache) {
    	                condition = is_src
    	                    ? x `${condition} && (${element.var}.src !== (${last} = ${value}))`
    	                    : x `${condition} && (${last} !== (${last} = ${value}))`;
    	            }
    	            if (block.has_outros) {
    	                condition = x `!#current || ${condition}`;
    	            }
    	            block.chunks.update.push(b `
				if (${condition}) {
					${updater}
				}`);
    	        }
    	        // special case – autofocus. has to be handled in a bit of a weird way
    	        if (this.node.is_true && name === 'autofocus') {
    	            block.autofocus = element.var;
    	        }
    	        if (is_indirectly_bound_value) {
    	            const update_value = b `${element.var}.value = ${element.var}.__value;`;
    	            block.chunks.hydrate.push(update_value);
    	            if (this.node.get_dependencies().length > 0)
    	                block.chunks.update.push(update_value);
    	        }
    	    }
    	    get_metadata() {
    	        if (this.parent.node.namespace)
    	            return null;
    	        const metadata = attribute_lookup[fix_attribute_casing(this.node.name)];
    	        if (metadata && metadata.applies_to && !metadata.applies_to.includes(this.parent.node.name))
    	            return null;
    	        return metadata;
    	    }
    	    get_value(block) {
    	        if (this.node.is_true) {
    	            const metadata = this.get_metadata();
    	            if (metadata && boolean_attribute.has(metadata.property_name.toLowerCase())) {
    	                return x `true`;
    	            }
    	            return x `""`;
    	        }
    	        if (this.node.chunks.length === 0)
    	            return x `""`;
    	        // TODO some of this code is repeated in Tag.ts — would be good to
    	        // DRY it out if that's possible without introducing crazy indirection
    	        if (this.node.chunks.length === 1) {
    	            return this.node.chunks[0].type === 'Text'
    	                ? string_literal(this.node.chunks[0].data)
    	                : this.node.chunks[0].manipulate(block);
    	        }
    	        let value = this.node.name === 'class'
    	            ? this.get_class_name_text(block)
    	            : this.render_chunks(block).reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	        // '{foo} {bar}' — treat as string concatenation
    	        if (this.node.chunks[0].type !== 'Text') {
    	            value = x `"" + ${value}`;
    	        }
    	        return value;
    	    }
    	    get_class_name_text(block) {
    	        const scoped_css = this.node.chunks.some((chunk) => chunk.synthetic);
    	        const rendered = this.render_chunks(block);
    	        if (scoped_css && rendered.length === 2) {
    	            // we have a situation like class={possiblyUndefined}
    	            rendered[0] = x `@null_to_empty(${rendered[0]})`;
    	        }
    	        return rendered.reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	    }
    	    render_chunks(block) {
    	        return this.node.chunks.map((chunk) => {
    	            if (chunk.type === 'Text') {
    	                return string_literal(chunk.data);
    	            }
    	            return chunk.manipulate(block);
    	        });
    	    }
    	    stringify() {
    	        if (this.node.is_true)
    	            return '';
    	        const value = this.node.chunks;
    	        if (value.length === 0)
    	            return `=""`;
    	        return `="${value.map(chunk => {
            return chunk.type === 'Text'
                ? chunk.data.replace(/"/g, '\\"')
                : `\${${chunk.manipulate()}}`;
        }).join('')}"`;
    	    }
    	}
    	// source: https://html.spec.whatwg.org/multipage/indices.html
    	const attribute_lookup = {
    	    allowfullscreen: { property_name: 'allowFullscreen', applies_to: ['iframe'] },
    	    allowpaymentrequest: { property_name: 'allowPaymentRequest', applies_to: ['iframe'] },
    	    async: { applies_to: ['script'] },
    	    autofocus: { applies_to: ['button', 'input', 'keygen', 'select', 'textarea'] },
    	    autoplay: { applies_to: ['audio', 'video'] },
    	    checked: { applies_to: ['input'] },
    	    controls: { applies_to: ['audio', 'video'] },
    	    default: { applies_to: ['track'] },
    	    defer: { applies_to: ['script'] },
    	    disabled: {
    	        applies_to: [
    	            'button',
    	            'fieldset',
    	            'input',
    	            'keygen',
    	            'optgroup',
    	            'option',
    	            'select',
    	            'textarea',
    	        ],
    	    },
    	    formnovalidate: { property_name: 'formNoValidate', applies_to: ['button', 'input'] },
    	    hidden: {},
    	    indeterminate: { applies_to: ['input'] },
    	    ismap: { property_name: 'isMap', applies_to: ['img'] },
    	    loop: { applies_to: ['audio', 'bgsound', 'video'] },
    	    multiple: { applies_to: ['input', 'select'] },
    	    muted: { applies_to: ['audio', 'video'] },
    	    nomodule: { property_name: 'noModule', applies_to: ['script'] },
    	    novalidate: { property_name: 'noValidate', applies_to: ['form'] },
    	    open: { applies_to: ['details', 'dialog'] },
    	    playsinline: { property_name: 'playsInline', applies_to: ['video'] },
    	    readonly: { property_name: 'readOnly', applies_to: ['input', 'textarea'] },
    	    required: { applies_to: ['input', 'select', 'textarea'] },
    	    reversed: { applies_to: ['ol'] },
    	    selected: { applies_to: ['option'] },
    	    value: {
    	        applies_to: [
    	            'button',
    	            'option',
    	            'input',
    	            'li',
    	            'meter',
    	            'progress',
    	            'param',
    	            'select',
    	            'textarea',
    	        ],
    	    },
    	};
    	Object.keys(attribute_lookup).forEach(name => {
    	    const metadata = attribute_lookup[name];
    	    if (!metadata.property_name)
    	        metadata.property_name = name;
    	});
    	// source: https://html.spec.whatwg.org/multipage/indices.html
    	const boolean_attribute = new Set([
    	    'allowfullscreen',
    	    'allowpaymentrequest',
    	    'async',
    	    'autofocus',
    	    'autoplay',
    	    'checked',
    	    'controls',
    	    'default',
    	    'defer',
    	    'disabled',
    	    'formnovalidate',
    	    'hidden',
    	    'ismap',
    	    'itemscope',
    	    'loop',
    	    'multiple',
    	    'muted',
    	    'nomodule',
    	    'novalidate',
    	    'open',
    	    'playsinline',
    	    'readonly',
    	    'required',
    	    'reversed',
    	    'selected'
    	]);

    	class StyleAttributeWrapper extends AttributeWrapper {
    	    render(block) {
    	        const style_props = optimize_style(this.node.chunks);
    	        if (!style_props)
    	            return super.render(block);
    	        style_props.forEach((prop) => {
    	            let value;
    	            if (is_dynamic(prop.value)) {
    	                const prop_dependencies = new Set();
    	                value = prop.value
    	                    .map(chunk => {
    	                    if (chunk.type === 'Text') {
    	                        return string_literal(chunk.data);
    	                    }
    	                    else {
    	                        add_to_set(prop_dependencies, chunk.dynamic_dependencies());
    	                        return chunk.manipulate(block);
    	                    }
    	                })
    	                    .reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	                // TODO is this necessary? style.setProperty always treats value as string, no?
    	                // if (prop.value.length === 1 || prop.value[0].type !== 'Text') {
    	                // 	value = x`"" + ${value}`;
    	                // }
    	                if (prop_dependencies.size) {
    	                    let condition = block.renderer.dirty(Array.from(prop_dependencies));
    	                    if (block.has_outros) {
    	                        condition = x `!#current || ${condition}`;
    	                    }
    	                    const update = b `
						if (${condition}) {
							@set_style(${this.parent.var}, "${prop.key}", ${value}, ${prop.important ? 1 : null});
						}`;
    	                    block.chunks.update.push(update);
    	                }
    	            }
    	            else {
    	                value = string_literal(prop.value[0].data);
    	            }
    	            block.chunks.hydrate.push(b `@set_style(${this.parent.var}, "${prop.key}", ${value}, ${prop.important ? 1 : null});`);
    	        });
    	    }
    	}
    	function optimize_style(value) {
    	    const props = [];
    	    let chunks = value.slice();
    	    while (chunks.length) {
    	        const chunk = chunks[0];
    	        if (chunk.type !== 'Text')
    	            return null;
    	        const key_match = /^\s*([\w-]+):\s*/.exec(chunk.data);
    	        if (!key_match)
    	            return null;
    	        const key = key_match[1];
    	        const offset = key_match.index + key_match[0].length;
    	        const remaining_data = chunk.data.slice(offset);
    	        if (remaining_data) {
    	            chunks[0] = {
    	                start: chunk.start + offset,
    	                end: chunk.end,
    	                type: 'Text',
    	                data: remaining_data
    	            };
    	        }
    	        else {
    	            chunks.shift();
    	        }
    	        const result = get_style_value(chunks);
    	        props.push({ key, value: result.value, important: result.important });
    	        chunks = result.chunks;
    	    }
    	    return props;
    	}
    	function get_style_value(chunks) {
    	    const value = [];
    	    let in_url = false;
    	    let quote_mark = null;
    	    let escaped = false;
    	    let closed = false;
    	    while (chunks.length && !closed) {
    	        const chunk = chunks.shift();
    	        if (chunk.type === 'Text') {
    	            let c = 0;
    	            while (c < chunk.data.length) {
    	                const char = chunk.data[c];
    	                if (escaped) {
    	                    escaped = false;
    	                }
    	                else if (char === '\\') {
    	                    escaped = true;
    	                }
    	                else if (char === quote_mark) {
    	                    quote_mark = null;
    	                }
    	                else if (char === '"' || char === "'") {
    	                    quote_mark = char;
    	                }
    	                else if (char === ')' && in_url) {
    	                    in_url = false;
    	                }
    	                else if (char === 'u' && chunk.data.slice(c, c + 4) === 'url(') {
    	                    in_url = true;
    	                }
    	                else if (char === ';' && !in_url && !quote_mark) {
    	                    closed = true;
    	                    break;
    	                }
    	                c += 1;
    	            }
    	            if (c > 0) {
    	                value.push({
    	                    type: 'Text',
    	                    start: chunk.start,
    	                    end: chunk.start + c,
    	                    data: chunk.data.slice(0, c)
    	                });
    	            }
    	            while (/[;\s]/.test(chunk.data[c]))
    	                c += 1;
    	            const remaining_data = chunk.data.slice(c);
    	            if (remaining_data) {
    	                chunks.unshift({
    	                    start: chunk.start + c,
    	                    end: chunk.end,
    	                    type: 'Text',
    	                    data: remaining_data
    	                });
    	                break;
    	            }
    	        }
    	        else {
    	            value.push(chunk);
    	        }
    	    }
    	    let important = false;
    	    const last_chunk = value[value.length - 1];
    	    if (last_chunk && last_chunk.type === 'Text' && /\s*!important\s*$/.test(last_chunk.data)) {
    	        important = true;
    	        last_chunk.data = last_chunk.data.replace(/\s*!important\s*$/, '');
    	        if (!last_chunk.data)
    	            value.pop();
    	    }
    	    return {
    	        chunks,
    	        value,
    	        important
    	    };
    	}
    	function is_dynamic(value) {
    	    return value.length > 1 || value[0].type !== 'Text';
    	}

    	function get_object(node) {
    	    while (node.type === 'MemberExpression')
    	        node = node.object;
    	    return node;
    	}

    	function flatten_reference(node) {
    	    const nodes = [];
    	    const parts = [];
    	    while (node.type === 'MemberExpression') {
    	        nodes.unshift(node.property);
    	        if (!node.computed) {
    	            parts.unshift(node.property.name);
    	        }
    	        node = node.object;
    	    }
    	    const name = node.type === 'Identifier'
    	        ? node.name
    	        : node.type === 'ThisExpression' ? 'this' : null;
    	    nodes.unshift(node);
    	    if (!node.computed) {
    	        parts.unshift(name);
    	    }
    	    return { name, nodes, parts };
    	}

    	class BindingWrapper {
    	    constructor(block, node, parent) {
    	        this.node = node;
    	        this.parent = parent;
    	        const { dependencies } = this.node.expression;
    	        block.add_dependencies(dependencies);
    	        // TODO does this also apply to e.g. `<input type='checkbox' bind:group='foo'>`?
    	        if (parent.node.name === 'select') {
    	            parent.select_binding_dependencies = dependencies;
    	            dependencies.forEach((prop) => {
    	                parent.renderer.component.indirect_dependencies.set(prop, new Set());
    	            });
    	        }
    	        if (node.is_contextual) {
    	            // we need to ensure that the each block creates a context including
    	            // the list and the index, if they're not otherwise referenced
    	            const { name } = get_object(this.node.expression.node);
    	            const each_block = this.parent.node.scope.get_owner(name);
    	            each_block.has_binding = true;
    	        }
    	        this.object = get_object(this.node.expression.node).name;
    	        // view to model
    	        this.handler = get_event_handler(this, parent.renderer, block, this.object, this.node.raw_expression);
    	        this.snippet = this.node.expression.manipulate(block);
    	        this.is_readonly = this.node.is_readonly;
    	        this.needs_lock = this.node.name === 'currentTime' || (parent.node.name === 'input' && parent.node.get_static_attribute_value('type') === 'number'); // TODO others?
    	    }
    	    get_dependencies() {
    	        const dependencies = new Set(this.node.expression.dependencies);
    	        this.node.expression.dependencies.forEach((prop) => {
    	            const indirect_dependencies = this.parent.renderer.component.indirect_dependencies.get(prop);
    	            if (indirect_dependencies) {
    	                indirect_dependencies.forEach(indirect_dependency => {
    	                    dependencies.add(indirect_dependency);
    	                });
    	            }
    	        });
    	        return dependencies;
    	    }
    	    is_readonly_media_attribute() {
    	        return this.node.is_readonly_media_attribute();
    	    }
    	    render(block, lock) {
    	        if (this.is_readonly)
    	            return;
    	        const { parent } = this;
    	        const update_conditions = this.needs_lock ? [x `!${lock}`] : [];
    	        const mount_conditions = [];
    	        const dependency_array = [...this.node.expression.dependencies];
    	        if (dependency_array.length > 0) {
    	            update_conditions.push(block.renderer.dirty(dependency_array));
    	        }
    	        if (parent.node.name === 'input') {
    	            const type = parent.node.get_static_attribute_value('type');
    	            if (type === null || type === "" || type === "text" || type === "email" || type === "password") {
    	                update_conditions.push(x `(${parent.var}.${this.node.name} !== ${this.snippet})`);
    	            }
    	        }
    	        // model to view
    	        let update_dom = get_dom_updater(parent, this);
    	        let mount_dom = update_dom;
    	        // special cases
    	        switch (this.node.name) {
    	            case 'group':
    	                {
    	                    const binding_group = get_binding_group(parent.renderer, this.node.expression.node);
    	                    block.renderer.add_to_context(`$$binding_groups`);
    	                    const reference = block.renderer.reference(`$$binding_groups`);
    	                    block.chunks.hydrate.push(b `${reference}[${binding_group}].push(${parent.var});`);
    	                    block.chunks.destroy.push(b `${reference}[${binding_group}].splice(${reference}[${binding_group}].indexOf(${parent.var}), 1);`);
    	                    break;
    	                }
    	            case 'textContent':
    	                update_conditions.push(x `${this.snippet} !== ${parent.var}.textContent`);
    	                mount_conditions.push(x `${this.snippet} !== void 0`);
    	                break;
    	            case 'innerHTML':
    	                update_conditions.push(x `${this.snippet} !== ${parent.var}.innerHTML`);
    	                mount_conditions.push(x `${this.snippet} !== void 0`);
    	                break;
    	            case 'currentTime':
    	                update_conditions.push(x `!@_isNaN(${this.snippet})`);
    	                mount_dom = null;
    	                break;
    	            case 'playbackRate':
    	            case 'volume':
    	                update_conditions.push(x `!@_isNaN(${this.snippet})`);
    	                mount_conditions.push(x `!@_isNaN(${this.snippet})`);
    	                break;
    	            case 'paused':
    	                {
    	                    // this is necessary to prevent audio restarting by itself
    	                    const last = block.get_unique_name(`${parent.var.name}_is_paused`);
    	                    block.add_variable(last, x `true`);
    	                    update_conditions.push(x `${last} !== (${last} = ${this.snippet})`);
    	                    update_dom = b `${parent.var}[${last} ? "pause" : "play"]();`;
    	                    mount_dom = null;
    	                    break;
    	                }
    	            case 'value':
    	                if (parent.node.get_static_attribute_value('type') === 'file') {
    	                    update_dom = null;
    	                    mount_dom = null;
    	                }
    	        }
    	        if (update_dom) {
    	            if (update_conditions.length > 0) {
    	                const condition = update_conditions.reduce((lhs, rhs) => x `${lhs} && ${rhs}`);
    	                block.chunks.update.push(b `
					if (${condition}) {
						${update_dom}
					}
				`);
    	            }
    	            else {
    	                block.chunks.update.push(update_dom);
    	            }
    	        }
    	        if (mount_dom) {
    	            if (mount_conditions.length > 0) {
    	                const condition = mount_conditions.reduce((lhs, rhs) => x `${lhs} && ${rhs}`);
    	                block.chunks.mount.push(b `
					if (${condition}) {
						${mount_dom}
					}
				`);
    	            }
    	            else {
    	                block.chunks.mount.push(mount_dom);
    	            }
    	        }
    	    }
    	}
    	function get_dom_updater(element, binding) {
    	    const { node } = element;
    	    if (binding.is_readonly_media_attribute()) {
    	        return null;
    	    }
    	    if (binding.node.name === 'this') {
    	        return null;
    	    }
    	    if (node.name === 'select') {
    	        return node.get_static_attribute_value('multiple') === true ?
    	            b `@select_options(${element.var}, ${binding.snippet})` :
    	            b `@select_option(${element.var}, ${binding.snippet})`;
    	    }
    	    if (binding.node.name === 'group') {
    	        const type = node.get_static_attribute_value('type');
    	        const condition = type === 'checkbox'
    	            ? x `~${binding.snippet}.indexOf(${element.var}.__value)`
    	            : x `${element.var}.__value === ${binding.snippet}`;
    	        return b `${element.var}.checked = ${condition};`;
    	    }
    	    if (binding.node.name === 'value') {
    	        return b `@set_input_value(${element.var}, ${binding.snippet});`;
    	    }
    	    return b `${element.var}.${binding.node.name} = ${binding.snippet};`;
    	}
    	function get_binding_group(renderer, value) {
    	    const { parts } = flatten_reference(value); // TODO handle cases involving computed member expressions
    	    const keypath = parts.join('.');
    	    // TODO handle contextual bindings — `keypath` should include unique ID of
    	    // each block that provides context
    	    let index = renderer.binding_groups.indexOf(keypath);
    	    if (index === -1) {
    	        index = renderer.binding_groups.length;
    	        renderer.binding_groups.push(keypath);
    	    }
    	    return index;
    	}
    	function get_event_handler(binding, renderer, block, name, lhs) {
    	    const value = get_value_from_dom(renderer, binding.parent, binding);
    	    const contextual_dependencies = new Set(binding.node.expression.contextual_dependencies);
    	    const context = block.bindings.get(name);
    	    let set_store;
    	    if (context) {
    	        const { object, property, modifier, store } = context;
    	        if (lhs.type === 'Identifier') {
    	            lhs = modifier(x `${object}[${property}]`);
    	            contextual_dependencies.add(object.name);
    	            contextual_dependencies.add(property.name);
    	        }
    	        if (store) {
    	            set_store = b `${store}.set(${`$${store}`});`;
    	        }
    	    }
    	    else {
    	        const object = get_object(lhs);
    	        if (object.name[0] === '$') {
    	            const store = object.name.slice(1);
    	            set_store = b `${store}.set(${object.name});`;
    	        }
    	    }
    	    const mutation = b `
		${lhs} = ${value};
		${set_store}
	`;
    	    return {
    	        uses_context: binding.node.is_contextual || binding.node.expression.uses_context,
    	        mutation,
    	        contextual_dependencies
    	    };
    	}
    	function get_value_from_dom(renderer, element, binding) {
    	    const { node } = element;
    	    const { name } = binding.node;
    	    if (name === 'this') {
    	        return x `$$node`;
    	    }
    	    // <select bind:value='selected>
    	    if (node.name === 'select') {
    	        return node.get_static_attribute_value('multiple') === true ?
    	            x `@select_multiple_value(this)` :
    	            x `@select_value(this)`;
    	    }
    	    const type = node.get_static_attribute_value('type');
    	    // <input type='checkbox' bind:group='foo'>
    	    if (name === 'group') {
    	        const binding_group = get_binding_group(renderer, binding.node.expression.node);
    	        if (type === 'checkbox') {
    	            return x `@get_binding_group_value($$binding_groups[${binding_group}])`;
    	        }
    	        return x `this.__value`;
    	    }
    	    // <input type='range|number' bind:value>
    	    if (type === 'range' || type === 'number') {
    	        return x `@to_number(this.${name})`;
    	    }
    	    if ((name === 'buffered' || name === 'seekable' || name === 'played')) {
    	        return x `@time_ranges_to_array(this.${name})`;
    	    }
    	    // everything else
    	    return x `this.${name}`;
    	}

    	function add_event_handlers(block, target, handlers) {
    	    handlers.forEach(handler => handler.render(block, target));
    	}

    	function add_actions(block, target, actions) {
    	    actions.forEach(action => {
    	        const { expression } = action;
    	        let snippet;
    	        let dependencies;
    	        if (expression) {
    	            snippet = expression.manipulate(block);
    	            dependencies = expression.dynamic_dependencies();
    	        }
    	        const id = block.get_unique_name(`${action.name.replace(/[^a-zA-Z0-9_$]/g, '_')}_action`);
    	        block.add_variable(id);
    	        const fn = block.renderer.reference(action.name);
    	        block.chunks.mount.push(b `${id} = ${fn}.call(null, ${target}, ${snippet}) || {};`);
    	        if (dependencies && dependencies.length > 0) {
    	            let condition = x `@is_function(${id}.update)`;
    	            if (dependencies.length > 0) {
    	                condition = x `${condition} && ${block.renderer.dirty(dependencies)}`;
    	            }
    	            block.chunks.update.push(b `if (${condition}) ${id}.update.call(null, ${snippet});`);
    	        }
    	        block.chunks.destroy.push(b `if (${id} && @is_function(${id}.destroy)) ${id}.destroy();`);
    	    });
    	}

    	function get_slot_definition(block, scope, lets) {
    	    if (lets.length === 0)
    	        return { block, scope };
    	    const input = {
    	        type: 'ObjectPattern',
    	        properties: lets.map(l => ({
    	            type: 'Property',
    	            kind: 'init',
    	            key: l.name,
    	            value: l.value || l.name
    	        }))
    	    };
    	    const names = new Set();
    	    lets.forEach(l => {
    	        l.names.forEach(name => {
    	            names.add(name);
    	        });
    	    });
    	    const context = {
    	        type: 'ObjectExpression',
    	        properties: Array.from(names).map(name => p `${block.renderer.context_lookup.get(name).index}: ${name}`)
    	    };
    	    const changes = Array.from(names)
    	        .map(name => {
    	        const { context_lookup } = block.renderer;
    	        const literal = {
    	            type: 'Literal',
    	            get value() {
    	                const i = context_lookup.get(name).index.value;
    	                return 1 << i;
    	            }
    	        };
    	        return x `${name} ? ${literal} : 0`;
    	    })
    	        .reduce((lhs, rhs) => x `${lhs} | ${rhs}`);
    	    return {
    	        block,
    	        scope,
    	        get_context: x `${input} => ${context}`,
    	        get_changes: x `${input} => ${changes}`
    	    };
    	}

    	function bind_this(component, block, binding, variable) {
    	    const fn = component.get_unique_name(`${variable.name}_binding`);
    	    block.renderer.add_to_context(fn.name);
    	    const callee = block.renderer.reference(fn.name);
    	    let lhs;
    	    let object;
    	    let body;
    	    if (binding.is_contextual && binding.raw_expression.type === 'Identifier') {
    	        // bind:x={y} — we can't just do `y = x`, we need to
    	        // to `array[index] = x;
    	        const { name } = binding.raw_expression;
    	        const { snippet } = block.bindings.get(name);
    	        lhs = snippet;
    	        body = b `${lhs} = $$value`; // TODO we need to invalidate... something
    	    }
    	    else {
    	        object = flatten_reference(binding.raw_expression).name;
    	        lhs = binding.raw_expression;
    	        body = binding.raw_expression.type === 'Identifier'
    	            ? b `
				${block.renderer.invalidate(object, x `${lhs} = $$value`)};
			`
    	            : b `
				${lhs} = $$value;
				${block.renderer.invalidate(object)};
			`;
    	    }
    	    const contextual_dependencies = Array.from(binding.expression.contextual_dependencies).map(name => ({
    	        type: 'Identifier',
    	        name
    	    }));
    	    if (contextual_dependencies.length) {
    	        component.partly_hoisted.push(b `
			function ${fn}($$value, ${contextual_dependencies}) {
				if (${lhs} === $$value) return;
				@binding_callbacks[$$value ? 'unshift' : 'push'](() => {
					${body}
				});
			}
		`);
    	        const args = [];
    	        for (const id of contextual_dependencies) {
    	            args.push(id);
    	            block.add_variable(id, block.renderer.reference(id.name));
    	        }
    	        const assign = block.get_unique_name(`assign_${variable.name}`);
    	        const unassign = block.get_unique_name(`unassign_${variable.name}`);
    	        block.chunks.init.push(b `
			const ${assign} = () => ${callee}(${variable}, ${args});
			const ${unassign} = () => ${callee}(null, ${args});
		`);
    	        const condition = Array.from(contextual_dependencies)
    	            .map(name => x `${name} !== ${block.renderer.reference(name.name)}`)
    	            .reduce((lhs, rhs) => x `${lhs} || ${rhs}`);
    	        // we push unassign and unshift assign so that references are
    	        // nulled out before they're created, to avoid glitches
    	        // with shifting indices
    	        block.chunks.update.push(b `
			if (${condition}) {
				${unassign}();
				${args.map(a => b `${a} = ${block.renderer.reference(a.name)}`)};
				${assign}();
			}`);
    	        block.chunks.destroy.push(b `${unassign}();`);
    	        return b `${assign}();`;
    	    }
    	    component.partly_hoisted.push(b `
		function ${fn}($$value) {
			@binding_callbacks[$$value ? 'unshift' : 'push'](() => {
				${body}
			});
		}
	`);
    	    block.chunks.destroy.push(b `${callee}(null);`);
    	    return b `${callee}(${variable});`;
    	}

    	const events = [
    	    {
    	        event_names: ['input'],
    	        filter: (node, _name) => node.name === 'textarea' ||
    	            node.name === 'input' && !/radio|checkbox|range|file/.test(node.get_static_attribute_value('type'))
    	    },
    	    {
    	        event_names: ['input'],
    	        filter: (node, name) => (name === 'textContent' || name === 'innerHTML') &&
    	            node.attributes.some(attribute => attribute.name === 'contenteditable')
    	    },
    	    {
    	        event_names: ['change'],
    	        filter: (node, _name) => node.name === 'select' ||
    	            node.name === 'input' && /radio|checkbox|file/.test(node.get_static_attribute_value('type'))
    	    },
    	    {
    	        event_names: ['change', 'input'],
    	        filter: (node, _name) => node.name === 'input' && node.get_static_attribute_value('type') === 'range'
    	    },
    	    {
    	        event_names: ['elementresize'],
    	        filter: (_node, name) => dimensions.test(name)
    	    },
    	    // media events
    	    {
    	        event_names: ['timeupdate'],
    	        filter: (node, name) => node.is_media_node() &&
    	            (name === 'currentTime' || name === 'played' || name === 'ended')
    	    },
    	    {
    	        event_names: ['durationchange'],
    	        filter: (node, name) => node.is_media_node() &&
    	            name === 'duration'
    	    },
    	    {
    	        event_names: ['play', 'pause'],
    	        filter: (node, name) => node.is_media_node() &&
    	            name === 'paused'
    	    },
    	    {
    	        event_names: ['progress'],
    	        filter: (node, name) => node.is_media_node() &&
    	            name === 'buffered'
    	    },
    	    {
    	        event_names: ['loadedmetadata'],
    	        filter: (node, name) => node.is_media_node() &&
    	            (name === 'buffered' || name === 'seekable')
    	    },
    	    {
    	        event_names: ['volumechange'],
    	        filter: (node, name) => node.is_media_node() &&
    	            name === 'volume'
    	    },
    	    {
    	        event_names: ['ratechange'],
    	        filter: (node, name) => node.is_media_node() &&
    	            name === 'playbackRate'
    	    },
    	    {
    	        event_names: ['seeking', 'seeked'],
    	        filter: (node, name) => node.is_media_node() &&
    	            (name === 'seeking')
    	    },
    	    {
    	        event_names: ['ended'],
    	        filter: (node, name) => node.is_media_node() &&
    	            name === 'ended'
    	    },
    	    {
    	        event_names: ['resize'],
    	        filter: (node, name) => node.is_media_node() &&
    	            (name === 'videoHeight' || name === 'videoWidth')
    	    },
    	    // details event
    	    {
    	        event_names: ['toggle'],
    	        filter: (node, _name) => node.name === 'details'
    	    },
    	];
    	class ElementWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = {
    	            type: 'Identifier',
    	            name: node.name.replace(/[^a-zA-Z0-9_$]/g, '_')
    	        };
    	        this.void = is_void(node.name);
    	        this.class_dependencies = [];
    	        if (this.node.children.length) {
    	            this.node.lets.forEach(l => {
    	                extract_names(l.value || l.name).forEach(name => {
    	                    renderer.add_to_context(name, true);
    	                });
    	            });
    	        }
    	        this.attributes = this.node.attributes.map(attribute => {
    	            if (attribute.name === 'slot') {
    	                // TODO make separate subclass for this?
    	                let owner = this.parent;
    	                while (owner) {
    	                    if (owner.node.type === 'InlineComponent') {
    	                        break;
    	                    }
    	                    if (owner.node.type === 'Element' && /-/.test(owner.node.name)) {
    	                        break;
    	                    }
    	                    owner = owner.parent;
    	                }
    	                if (owner && owner.node.type === 'InlineComponent') {
    	                    const name = attribute.get_static_value();
    	                    if (!owner.slots.has(name)) {
    	                        const child_block = block.child({
    	                            comment: create_debugging_comment(node, this.renderer.component),
    	                            name: this.renderer.component.get_unique_name(`create_${sanitize(name)}_slot`),
    	                            type: 'slot'
    	                        });
    	                        const { scope, lets } = this.node;
    	                        const seen = new Set(lets.map(l => l.name.name));
    	                        owner.node.lets.forEach(l => {
    	                            if (!seen.has(l.name.name))
    	                                lets.push(l);
    	                        });
    	                        owner.slots.set(name, get_slot_definition(child_block, scope, lets));
    	                        this.renderer.blocks.push(child_block);
    	                    }
    	                    this.slot_block = owner.slots.get(name).block;
    	                    block = this.slot_block;
    	                }
    	            }
    	            if (attribute.name === 'style') {
    	                return new StyleAttributeWrapper(this, block, attribute);
    	            }
    	            return new AttributeWrapper(this, block, attribute);
    	        });
    	        // ordinarily, there'll only be one... but we need to handle
    	        // the rare case where an element can have multiple bindings,
    	        // e.g. <audio bind:paused bind:currentTime>
    	        this.bindings = this.node.bindings.map(binding => new BindingWrapper(block, binding, this));
    	        this.event_handlers = this.node.handlers.map(event_handler => new EventHandlerWrapper(event_handler, this));
    	        if (node.intro || node.outro) {
    	            if (node.intro)
    	                block.add_intro(node.intro.is_local);
    	            if (node.outro)
    	                block.add_outro(node.outro.is_local);
    	        }
    	        if (node.animation) {
    	            block.add_animation();
    	        }
    	        // add directive and handler dependencies
    	        [node.animation, node.outro, ...node.actions, ...node.classes].forEach(directive => {
    	            if (directive && directive.expression) {
    	                block.add_dependencies(directive.expression.dependencies);
    	            }
    	        });
    	        node.handlers.forEach(handler => {
    	            if (handler.expression) {
    	                block.add_dependencies(handler.expression.dependencies);
    	            }
    	        });
    	        if (this.parent) {
    	            if (node.actions.length > 0 ||
    	                node.animation ||
    	                node.bindings.length > 0 ||
    	                node.classes.length > 0 ||
    	                node.intro || node.outro ||
    	                node.handlers.length > 0 ||
    	                this.node.name === 'option' ||
    	                renderer.options.dev) {
    	                this.parent.cannot_use_innerhtml(); // need to use add_location
    	                this.parent.not_static_content();
    	            }
    	        }
    	        this.fragment = new FragmentWrapper(renderer, block, node.children, this, strip_whitespace, next_sibling);
    	        if (this.slot_block) {
    	            block.parent.add_dependencies(block.dependencies);
    	            // appalling hack
    	            const index = block.parent.wrappers.indexOf(this);
    	            block.parent.wrappers.splice(index, 1);
    	            block.wrappers.push(this);
    	        }
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        const { renderer } = this;
    	        if (this.node.name === 'noscript')
    	            return;
    	        if (this.slot_block) {
    	            block = this.slot_block;
    	        }
    	        const node = this.var;
    	        const nodes = parent_nodes && block.get_unique_name(`${this.var.name}_nodes`); // if we're in unclaimable territory, i.e. <head>, parent_nodes is null
    	        const children = x `@children(${this.node.name === 'template' ? x `${node}.content` : node})`;
    	        block.add_variable(node);
    	        const render_statement = this.get_render_statement(block);
    	        block.chunks.create.push(b `${node} = ${render_statement};`);
    	        if (renderer.options.hydratable) {
    	            if (parent_nodes) {
    	                block.chunks.claim.push(b `
					${node} = ${this.get_claim_statement(parent_nodes)};
				`);
    	                if (!this.void && this.node.children.length > 0) {
    	                    block.chunks.claim.push(b `
						var ${nodes} = ${children};
					`);
    	                }
    	            }
    	            else {
    	                block.chunks.claim.push(b `${node} = ${render_statement};`);
    	            }
    	        }
    	        if (parent_node) {
    	            block.chunks.mount.push(b `@append(${parent_node}, ${node});`);
    	            if (is_head(parent_node)) {
    	                block.chunks.destroy.push(b `@detach(${node});`);
    	            }
    	        }
    	        else {
    	            block.chunks.mount.push(b `@insert(#target, ${node}, anchor);`);
    	            // TODO we eventually need to consider what happens to elements
    	            // that belong to the same outgroup as an outroing element...
    	            block.chunks.destroy.push(b `if (detaching) @detach(${node});`);
    	        }
    	        // insert static children with textContent or innerHTML
    	        const can_use_textcontent = this.can_use_textcontent();
    	        if (!this.node.namespace && (this.can_use_innerhtml || can_use_textcontent) && this.fragment.nodes.length > 0) {
    	            if (this.fragment.nodes.length === 1 && this.fragment.nodes[0].node.type === 'Text') {
    	                block.chunks.create.push(
    	                // @ts-ignore todo: should it be this.fragment.nodes[0].node.data instead?
    	                b `${node}.textContent = ${string_literal(this.fragment.nodes[0].data)};`);
    	            }
    	            else {
    	                const state = {
    	                    quasi: {
    	                        type: 'TemplateElement',
    	                        value: { raw: '' }
    	                    }
    	                };
    	                const literal = {
    	                    type: 'TemplateLiteral',
    	                    expressions: [],
    	                    quasis: []
    	                };
    	                const can_use_raw_text = !this.can_use_innerhtml && can_use_textcontent;
    	                to_html(this.fragment.nodes, block, literal, state, can_use_raw_text);
    	                literal.quasis.push(state.quasi);
    	                block.chunks.create.push(b `${node}.${this.can_use_innerhtml ? 'innerHTML' : 'textContent'} = ${literal};`);
    	            }
    	        }
    	        else {
    	            this.fragment.nodes.forEach((child) => {
    	                child.render(block, this.node.name === 'template' ? x `${node}.content` : node, nodes);
    	            });
    	        }
    	        const event_handler_or_binding_uses_context = (this.bindings.some(binding => binding.handler.uses_context) ||
    	            this.node.handlers.some(handler => handler.uses_context) ||
    	            this.node.actions.some(action => action.uses_context));
    	        if (event_handler_or_binding_uses_context) {
    	            block.maintain_context = true;
    	        }
    	        this.add_attributes(block);
    	        this.add_bindings(block);
    	        this.add_event_handlers(block);
    	        this.add_transitions(block);
    	        this.add_animation(block);
    	        this.add_actions(block);
    	        this.add_classes(block);
    	        this.add_manual_style_scoping(block);
    	        if (nodes && this.renderer.options.hydratable && !this.void) {
    	            block.chunks.claim.push(b `${this.node.children.length > 0 ? nodes : children}.forEach(@detach);`);
    	        }
    	        if (renderer.options.dev) {
    	            const loc = renderer.locate(this.node.start);
    	            block.chunks.hydrate.push(b `@add_location(${this.var}, ${renderer.file_var}, ${loc.line - 1}, ${loc.column}, ${this.node.start});`);
    	        }
    	    }
    	    can_use_textcontent() {
    	        return this.is_static_content && this.fragment.nodes.every(node => node.node.type === 'Text' || node.node.type === 'MustacheTag');
    	    }
    	    get_render_statement(block) {
    	        const { name, namespace } = this.node;
    	        if (namespace === 'http://www.w3.org/2000/svg') {
    	            return x `@svg_element("${name}")`;
    	        }
    	        if (namespace) {
    	            return x `@_document.createElementNS("${namespace}", "${name}")`;
    	        }
    	        const is = this.attributes.find(attr => attr.node.name === 'is');
    	        if (is) {
    	            return x `@element_is("${name}", ${is.render_chunks(block).reduce((lhs, rhs) => x `${lhs} + ${rhs}`)});`;
    	        }
    	        return x `@element("${name}")`;
    	    }
    	    get_claim_statement(nodes) {
    	        const attributes = this.node.attributes
    	            .filter((attr) => attr.type === 'Attribute')
    	            .map((attr) => p `${attr.name}: true`);
    	        const name = this.node.namespace
    	            ? this.node.name
    	            : this.node.name.toUpperCase();
    	        const svg = this.node.namespace === namespaces.svg ? 1 : null;
    	        return x `@claim_element(${nodes}, "${name}", { ${attributes} }, ${svg})`;
    	    }
    	    add_bindings(block) {
    	        const { renderer } = this;
    	        if (this.bindings.length === 0)
    	            return;
    	        renderer.component.has_reactive_assignments = true;
    	        const lock = this.bindings.some(binding => binding.needs_lock) ?
    	            block.get_unique_name(`${this.var.name}_updating`) :
    	            null;
    	        if (lock)
    	            block.add_variable(lock, x `false`);
    	        const groups = events
    	            .map(event => ({
    	            events: event.event_names,
    	            bindings: this.bindings
    	                .filter(binding => binding.node.name !== 'this')
    	                .filter(binding => event.filter(this.node, binding.node.name))
    	        }))
    	            .filter(group => group.bindings.length);
    	        groups.forEach(group => {
    	            const handler = renderer.component.get_unique_name(`${this.var.name}_${group.events.join('_')}_handler`);
    	            renderer.add_to_context(handler.name);
    	            // TODO figure out how to handle locks
    	            const needs_lock = group.bindings.some(binding => binding.needs_lock);
    	            const dependencies = new Set();
    	            const contextual_dependencies = new Set();
    	            group.bindings.forEach(binding => {
    	                // TODO this is a mess
    	                add_to_set(dependencies, binding.get_dependencies());
    	                add_to_set(contextual_dependencies, binding.node.expression.contextual_dependencies);
    	                add_to_set(contextual_dependencies, binding.handler.contextual_dependencies);
    	                binding.render(block, lock);
    	            });
    	            // media bindings — awkward special case. The native timeupdate events
    	            // fire too infrequently, so we need to take matters into our
    	            // own hands
    	            let animation_frame;
    	            if (group.events[0] === 'timeupdate') {
    	                animation_frame = block.get_unique_name(`${this.var.name}_animationframe`);
    	                block.add_variable(animation_frame);
    	            }
    	            const has_local_function = contextual_dependencies.size > 0 || needs_lock || animation_frame;
    	            let callee = renderer.reference(handler);
    	            // TODO dry this out — similar code for event handlers and component bindings
    	            if (has_local_function) {
    	                const args = Array.from(contextual_dependencies).map(name => renderer.reference(name));
    	                // need to create a block-local function that calls an instance-level function
    	                if (animation_frame) {
    	                    block.chunks.init.push(b `
						function ${handler}() {
							@_cancelAnimationFrame(${animation_frame});
							if (!${this.var}.paused) {
								${animation_frame} = @raf(${handler});
								${needs_lock && b `${lock} = true;`}
							}
							${callee}.call(${this.var}, ${args});
						}
					`);
    	                }
    	                else {
    	                    block.chunks.init.push(b `
						function ${handler}() {
							${needs_lock && b `${lock} = true;`}
							${callee}.call(${this.var}, ${args});
						}
					`);
    	                }
    	                callee = handler;
    	            }
    	            const params = Array.from(contextual_dependencies).map(name => ({
    	                type: 'Identifier',
    	                name
    	            }));
    	            this.renderer.component.partly_hoisted.push(b `
				function ${handler}(${params}) {
					${group.bindings.map(b => b.handler.mutation)}
					${Array.from(dependencies)
                .filter(dep => dep[0] !== '$')
                .filter(dep => !contextual_dependencies.has(dep))
                .map(dep => b `${this.renderer.invalidate(dep)};`)}
				}
			`);
    	            group.events.forEach(name => {
    	                if (name === 'elementresize') {
    	                    // special case
    	                    const resize_listener = block.get_unique_name(`${this.var.name}_resize_listener`);
    	                    block.add_variable(resize_listener);
    	                    block.chunks.mount.push(b `${resize_listener} = @add_resize_listener(${this.var}, ${callee}.bind(${this.var}));`);
    	                    block.chunks.destroy.push(b `${resize_listener}.cancel();`);
    	                }
    	                else {
    	                    block.event_listeners.push(x `@listen(${this.var}, "${name}", ${callee})`);
    	                }
    	            });
    	            const some_initial_state_is_undefined = group.bindings
    	                .map(binding => x `${binding.snippet} === void 0`)
    	                .reduce((lhs, rhs) => x `${lhs} || ${rhs}`);
    	            const should_initialise = (this.node.name === 'select' ||
    	                group.bindings.find(binding => {
    	                    return (binding.node.name === 'indeterminate' ||
    	                        binding.node.name === 'textContent' ||
    	                        binding.node.name === 'innerHTML' ||
    	                        binding.is_readonly_media_attribute());
    	                }));
    	            if (should_initialise) {
    	                const callback = has_local_function ? handler : x `() => ${callee}.call(${this.var})`;
    	                block.chunks.hydrate.push(b `if (${some_initial_state_is_undefined}) @add_render_callback(${callback});`);
    	            }
    	            if (group.events[0] === 'elementresize') {
    	                block.chunks.hydrate.push(b `@add_render_callback(() => ${callee}.call(${this.var}));`);
    	            }
    	        });
    	        if (lock) {
    	            block.chunks.update.push(b `${lock} = false;`);
    	        }
    	        const this_binding = this.bindings.find(b => b.node.name === 'this');
    	        if (this_binding) {
    	            const binding_callback = bind_this(renderer.component, block, this_binding.node, this.var);
    	            block.chunks.mount.push(binding_callback);
    	        }
    	    }
    	    add_attributes(block) {
    	        // Get all the class dependencies first
    	        this.attributes.forEach((attribute) => {
    	            if (attribute.node.name === 'class') {
    	                const dependencies = attribute.node.get_dependencies();
    	                this.class_dependencies.push(...dependencies);
    	            }
    	        });
    	        if (this.node.attributes.some(attr => attr.is_spread)) {
    	            this.add_spread_attributes(block);
    	            return;
    	        }
    	        this.attributes.forEach((attribute) => {
    	            attribute.render(block);
    	        });
    	    }
    	    add_spread_attributes(block) {
    	        const levels = block.get_unique_name(`${this.var.name}_levels`);
    	        const data = block.get_unique_name(`${this.var.name}_data`);
    	        const initial_props = [];
    	        const updates = [];
    	        this.attributes
    	            .forEach(attr => {
    	            const condition = attr.node.dependencies.size > 0
    	                ? block.renderer.dirty(Array.from(attr.node.dependencies))
    	                : null;
    	            if (attr.node.is_spread) {
    	                const snippet = attr.node.expression.manipulate(block);
    	                initial_props.push(snippet);
    	                updates.push(condition ? x `${condition} && ${snippet}` : snippet);
    	            }
    	            else {
    	                const metadata = attr.get_metadata();
    	                const snippet = x `{ ${(metadata && metadata.property_name) ||
                    fix_attribute_casing(attr.node.name)}: ${attr.get_value(block)} }`;
    	                initial_props.push(snippet);
    	                updates.push(condition ? x `${condition} && ${snippet}` : snippet);
    	            }
    	        });
    	        block.chunks.init.push(b `
			let ${levels} = [${initial_props}];

			let ${data} = {};
			for (let #i = 0; #i < ${levels}.length; #i += 1) {
				${data} = @assign(${data}, ${levels}[#i]);
			}
		`);
    	        const fn = this.node.namespace === namespaces.svg ? x `@set_svg_attributes` : x `@set_attributes`;
    	        block.chunks.hydrate.push(b `${fn}(${this.var}, ${data});`);
    	        block.chunks.update.push(b `
			${fn}(${this.var}, @get_spread_update(${levels}, [
				${updates}
			]));
		`);
    	    }
    	    add_event_handlers(block) {
    	        add_event_handlers(block, this.var, this.event_handlers);
    	    }
    	    add_transitions(block) {
    	        const { intro, outro } = this.node;
    	        if (!intro && !outro)
    	            return;
    	        if (intro === outro) {
    	            // bidirectional transition
    	            const name = block.get_unique_name(`${this.var.name}_transition`);
    	            const snippet = intro.expression
    	                ? intro.expression.manipulate(block)
    	                : x `{}`;
    	            block.add_variable(name);
    	            const fn = this.renderer.reference(intro.name);
    	            const intro_block = b `
				@add_render_callback(() => {
					if (!${name}) ${name} = @create_bidirectional_transition(${this.var}, ${fn}, ${snippet}, true);
					${name}.run(1);
				});
			`;
    	            const outro_block = b `
				if (!${name}) ${name} = @create_bidirectional_transition(${this.var}, ${fn}, ${snippet}, false);
				${name}.run(0);
			`;
    	            if (intro.is_local) {
    	                block.chunks.intro.push(b `
					if (#local) {
						${intro_block}
					}
				`);
    	                block.chunks.outro.push(b `
					if (#local) {
						${outro_block}
					}
				`);
    	            }
    	            else {
    	                block.chunks.intro.push(intro_block);
    	                block.chunks.outro.push(outro_block);
    	            }
    	            block.chunks.destroy.push(b `if (detaching && ${name}) ${name}.end();`);
    	        }
    	        else {
    	            const intro_name = intro && block.get_unique_name(`${this.var.name}_intro`);
    	            const outro_name = outro && block.get_unique_name(`${this.var.name}_outro`);
    	            if (intro) {
    	                block.add_variable(intro_name);
    	                const snippet = intro.expression
    	                    ? intro.expression.manipulate(block)
    	                    : x `{}`;
    	                const fn = this.renderer.reference(intro.name);
    	                let intro_block;
    	                if (outro) {
    	                    intro_block = b `
						@add_render_callback(() => {
							if (${outro_name}) ${outro_name}.end(1);
							if (!${intro_name}) ${intro_name} = @create_in_transition(${this.var}, ${fn}, ${snippet});
							${intro_name}.start();
						});
					`;
    	                    block.chunks.outro.push(b `if (${intro_name}) ${intro_name}.invalidate();`);
    	                }
    	                else {
    	                    intro_block = b `
						if (!${intro_name}) {
							@add_render_callback(() => {
								${intro_name} = @create_in_transition(${this.var}, ${fn}, ${snippet});
								${intro_name}.start();
							});
						}
					`;
    	                }
    	                if (intro.is_local) {
    	                    intro_block = b `
						if (#local) {
							${intro_block}
						}
					`;
    	                }
    	                block.chunks.intro.push(intro_block);
    	            }
    	            if (outro) {
    	                block.add_variable(outro_name);
    	                const snippet = outro.expression
    	                    ? outro.expression.manipulate(block)
    	                    : x `{}`;
    	                const fn = this.renderer.reference(outro.name);
    	                if (!intro) {
    	                    block.chunks.intro.push(b `
						if (${outro_name}) ${outro_name}.end(1);
					`);
    	                }
    	                // TODO hide elements that have outro'd (unless they belong to a still-outroing
    	                // group) prior to their removal from the DOM
    	                let outro_block = b `
					${outro_name} = @create_out_transition(${this.var}, ${fn}, ${snippet});
				`;
    	                if (outro.is_local) {
    	                    outro_block = b `
						if (#local) {
							${outro_block}
						}
					`;
    	                }
    	                block.chunks.outro.push(outro_block);
    	                block.chunks.destroy.push(b `if (detaching && ${outro_name}) ${outro_name}.end();`);
    	            }
    	        }
    	    }
    	    add_animation(block) {
    	        if (!this.node.animation)
    	            return;
    	        const { outro } = this.node;
    	        const rect = block.get_unique_name('rect');
    	        const stop_animation = block.get_unique_name('stop_animation');
    	        block.add_variable(rect);
    	        block.add_variable(stop_animation, x `@noop`);
    	        block.chunks.measure.push(b `
			${rect} = ${this.var}.getBoundingClientRect();
		`);
    	        block.chunks.fix.push(b `
			@fix_position(${this.var});
			${stop_animation}();
			${outro && b `@add_transform(${this.var}, ${rect});`}
		`);
    	        const params = this.node.animation.expression ? this.node.animation.expression.manipulate(block) : x `{}`;
    	        const name = this.renderer.reference(this.node.animation.name);
    	        block.chunks.animate.push(b `
			${stop_animation}();
			${stop_animation} = @create_animation(${this.var}, ${rect}, ${name}, ${params});
		`);
    	    }
    	    add_actions(block) {
    	        add_actions(block, this.var, this.node.actions);
    	    }
    	    add_classes(block) {
    	        const has_spread = this.node.attributes.some(attr => attr.is_spread);
    	        this.node.classes.forEach(class_directive => {
    	            const { expression, name } = class_directive;
    	            let snippet;
    	            let dependencies;
    	            if (expression) {
    	                snippet = expression.manipulate(block);
    	                dependencies = expression.dependencies;
    	            }
    	            else {
    	                snippet = name;
    	                dependencies = new Set([name]);
    	            }
    	            const updater = b `@toggle_class(${this.var}, "${name}", ${snippet});`;
    	            block.chunks.hydrate.push(updater);
    	            if (has_spread) {
    	                block.chunks.update.push(updater);
    	            }
    	            else if ((dependencies && dependencies.size > 0) || this.class_dependencies.length) {
    	                const all_dependencies = this.class_dependencies.concat(...dependencies);
    	                const condition = block.renderer.dirty(all_dependencies);
    	                block.chunks.update.push(b `
					if (${condition}) {
						${updater}
					}`);
    	            }
    	        });
    	    }
    	    add_manual_style_scoping(block) {
    	        if (this.node.needs_manual_style_scoping) {
    	            const updater = b `@toggle_class(${this.var}, "${this.node.component.stylesheet.id}", true);`;
    	            block.chunks.hydrate.push(updater);
    	            block.chunks.update.push(updater);
    	        }
    	    }
    	}
    	function to_html(wrappers, block, literal, state, can_use_raw_text) {
    	    wrappers.forEach(wrapper => {
    	        if (wrapper.node.type === 'Text') {
    	            if (wrapper.use_space())
    	                state.quasi.value.raw += ' ';
    	            const parent = wrapper.node.parent;
    	            const raw = parent && (parent.name === 'script' ||
    	                parent.name === 'style' ||
    	                can_use_raw_text);
    	            state.quasi.value.raw += (raw ? wrapper.node.data : escape_html(wrapper.node.data))
    	                .replace(/\\/g, '\\\\')
    	                .replace(/`/g, '\\`')
    	                .replace(/\$/g, '\\$');
    	        }
    	        else if (wrapper.node.type === 'MustacheTag' || wrapper.node.type === 'RawMustacheTag') {
    	            literal.quasis.push(state.quasi);
    	            literal.expressions.push(wrapper.node.expression.manipulate(block));
    	            state.quasi = {
    	                type: 'TemplateElement',
    	                value: { raw: '' }
    	            };
    	        }
    	        else if (wrapper.node.name === 'noscript') ;
    	        else {
    	            // element
    	            state.quasi.value.raw += `<${wrapper.node.name}`;
    	            wrapper.attributes.forEach((attr) => {
    	                state.quasi.value.raw += ` ${fix_attribute_casing(attr.node.name)}="`;
    	                attr.node.chunks.forEach(chunk => {
    	                    if (chunk.type === 'Text') {
    	                        state.quasi.value.raw += escape_html(chunk.data);
    	                    }
    	                    else {
    	                        literal.quasis.push(state.quasi);
    	                        literal.expressions.push(chunk.manipulate(block));
    	                        state.quasi = {
    	                            type: 'TemplateElement',
    	                            value: { raw: '' }
    	                        };
    	                    }
    	                });
    	                state.quasi.value.raw += `"`;
    	            });
    	            state.quasi.value.raw += '>';
    	            if (!wrapper.void) {
    	                to_html(wrapper.fragment.nodes, block, literal, state);
    	                state.quasi.value.raw += `</${wrapper.node.name}>`;
    	            }
    	        }
    	    });
    	}

    	class HeadWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.can_use_innerhtml = false;
    	        this.fragment = new FragmentWrapper(renderer, block, node.children, this, strip_whitespace, next_sibling);
    	    }
    	    render(block, _parent_node, _parent_nodes) {
    	        this.fragment.render(block, x `@_document.head`, x `#nodes`);
    	    }
    	}

    	function is_else_if(node) {
    	    return (node && node.children.length === 1 && node.children[0].type === 'IfBlock');
    	}
    	class IfBlockBranch extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = null;
    	        const { expression } = node;
    	        const is_else = !expression;
    	        if (expression) {
    	            this.dependencies = expression.dynamic_dependencies();
    	            // TODO is this the right rule? or should any non-reference count?
    	            // const should_cache = !is_reference(expression.node, null) && dependencies.length > 0;
    	            let should_cache = false;
    	            walk(expression.node, {
    	                enter(node) {
    	                    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    	                        should_cache = true;
    	                    }
    	                }
    	            });
    	            if (should_cache) {
    	                this.condition = block.get_unique_name(`show_if`);
    	                this.snippet = expression.manipulate(block);
    	            }
    	            else {
    	                this.condition = expression.manipulate(block);
    	            }
    	        }
    	        this.block = block.child({
    	            comment: create_debugging_comment(node, parent.renderer.component),
    	            name: parent.renderer.component.get_unique_name(is_else ? `create_else_block` : `create_if_block`),
    	            type: node.expression ? 'if' : 'else'
    	        });
    	        this.fragment = new FragmentWrapper(renderer, this.block, node.children, parent, strip_whitespace, next_sibling);
    	        this.is_dynamic = this.block.dependencies.size > 0;
    	    }
    	}
    	class IfBlockWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.needs_update = false;
    	        this.var = { type: 'Identifier', name: 'if_block' };
    	        this.cannot_use_innerhtml();
    	        this.not_static_content();
    	        this.branches = [];
    	        const blocks = [];
    	        let is_dynamic = false;
    	        let has_intros = false;
    	        let has_outros = false;
    	        const create_branches = (node) => {
    	            const branch = new IfBlockBranch(renderer, block, this, node, strip_whitespace, next_sibling);
    	            this.branches.push(branch);
    	            blocks.push(branch.block);
    	            block.add_dependencies(node.expression.dependencies);
    	            if (branch.block.dependencies.size > 0) {
    	                // the condition, or its contents, is dynamic
    	                is_dynamic = true;
    	                block.add_dependencies(branch.block.dependencies);
    	            }
    	            if (branch.dependencies && branch.dependencies.length > 0) {
    	                // the condition itself is dynamic
    	                this.needs_update = true;
    	            }
    	            if (branch.block.has_intros)
    	                has_intros = true;
    	            if (branch.block.has_outros)
    	                has_outros = true;
    	            if (is_else_if(node.else)) {
    	                create_branches(node.else.children[0]);
    	            }
    	            else if (node.else) {
    	                const branch = new IfBlockBranch(renderer, block, this, node.else, strip_whitespace, next_sibling);
    	                this.branches.push(branch);
    	                blocks.push(branch.block);
    	                if (branch.block.dependencies.size > 0) {
    	                    is_dynamic = true;
    	                    block.add_dependencies(branch.block.dependencies);
    	                }
    	                if (branch.block.has_intros)
    	                    has_intros = true;
    	                if (branch.block.has_outros)
    	                    has_outros = true;
    	            }
    	        };
    	        create_branches(this.node);
    	        blocks.forEach(block => {
    	            block.has_update_method = is_dynamic;
    	            block.has_intro_method = has_intros;
    	            block.has_outro_method = has_outros;
    	        });
    	        renderer.blocks.push(...blocks);
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        const name = this.var;
    	        const needs_anchor = this.next ? !this.next.is_dom_node() : !parent_node || !this.parent.is_dom_node();
    	        const anchor = needs_anchor
    	            ? block.get_unique_name(`${this.var.name}_anchor`)
    	            : (this.next && this.next.var) || 'null';
    	        const has_else = !(this.branches[this.branches.length - 1].condition);
    	        const if_exists_condition = has_else ? null : name;
    	        const dynamic = this.branches[0].block.has_update_method; // can use [0] as proxy for all, since they necessarily have the same value
    	        const has_intros = this.branches[0].block.has_intro_method;
    	        const has_outros = this.branches[0].block.has_outro_method;
    	        const has_transitions = has_intros || has_outros;
    	        const vars = { name, anchor, if_exists_condition, has_else, has_transitions };
    	        const detaching = parent_node && !is_head(parent_node) ? null : 'detaching';
    	        if (this.node.else) {
    	            this.branches.forEach(branch => {
    	                if (branch.snippet)
    	                    block.add_variable(branch.condition);
    	            });
    	            if (has_outros) {
    	                this.render_compound_with_outros(block, parent_node, parent_nodes, dynamic, vars, detaching);
    	                block.chunks.outro.push(b `@transition_out(${name});`);
    	            }
    	            else {
    	                this.render_compound(block, parent_node, parent_nodes, dynamic, vars, detaching);
    	            }
    	        }
    	        else {
    	            this.render_simple(block, parent_node, parent_nodes, dynamic, vars, detaching);
    	            if (has_outros) {
    	                block.chunks.outro.push(b `@transition_out(${name});`);
    	            }
    	        }
    	        if (if_exists_condition) {
    	            block.chunks.create.push(b `if (${if_exists_condition}) ${name}.c();`);
    	        }
    	        else {
    	            block.chunks.create.push(b `${name}.c();`);
    	        }
    	        if (parent_nodes && this.renderer.options.hydratable) {
    	            if (if_exists_condition) {
    	                block.chunks.claim.push(b `if (${if_exists_condition}) ${name}.l(${parent_nodes});`);
    	            }
    	            else {
    	                block.chunks.claim.push(b `${name}.l(${parent_nodes});`);
    	            }
    	        }
    	        if (has_intros || has_outros) {
    	            block.chunks.intro.push(b `@transition_in(${name});`);
    	        }
    	        if (needs_anchor) {
    	            block.add_element(anchor, x `@empty()`, parent_nodes && x `@empty()`, parent_node);
    	        }
    	        this.branches.forEach(branch => {
    	            branch.fragment.render(branch.block, null, x `#nodes`);
    	        });
    	    }
    	    render_compound(block, parent_node, _parent_nodes, dynamic, { name, anchor, has_else, if_exists_condition, has_transitions }, detaching) {
    	        const select_block_type = this.renderer.component.get_unique_name(`select_block_type`);
    	        const current_block_type = block.get_unique_name(`current_block_type`);
    	        const get_block = has_else
    	            ? x `${current_block_type}(#ctx)`
    	            : x `${current_block_type} && ${current_block_type}(#ctx)`;
    	        if (this.needs_update) {
    	            block.chunks.init.push(b `
				function ${select_block_type}(#ctx, #dirty) {
					${this.branches.map(({ dependencies, condition, snippet, block }) => condition
                ? b `
					${snippet && (dependencies.length > 0
                    ? b `if (${condition} == null || ${block.renderer.dirty(dependencies)}) ${condition} = !!${snippet}`
                    : b `if (${condition} == null) ${condition} = !!${snippet}`)}
					if (${condition}) return ${block.name};`
                : b `return ${block.name};`)}
				}
			`);
    	        }
    	        else {
    	            block.chunks.init.push(b `
				function ${select_block_type}(#ctx, #dirty) {
					${this.branches.map(({ condition, snippet, block }) => condition
                ? b `if (${snippet || condition}) return ${block.name};`
                : b `return ${block.name};`)}
				}
			`);
    	        }
    	        block.chunks.init.push(b `
			let ${current_block_type} = ${select_block_type}(#ctx, -1);
			let ${name} = ${get_block};
		`);
    	        const initial_mount_node = parent_node || '#target';
    	        const anchor_node = parent_node ? 'null' : 'anchor';
    	        if (if_exists_condition) {
    	            block.chunks.mount.push(b `if (${if_exists_condition}) ${name}.m(${initial_mount_node}, ${anchor_node});`);
    	        }
    	        else {
    	            block.chunks.mount.push(b `${name}.m(${initial_mount_node}, ${anchor_node});`);
    	        }
    	        if (this.needs_update) {
    	            const update_mount_node = this.get_update_mount_node(anchor);
    	            const change_block = b `
				${if_exists_condition ? b `if (${if_exists_condition}) ${name}.d(1)` : b `${name}.d(1)`};
				${name} = ${get_block};
				if (${name}) {
					${name}.c();
					${has_transitions && b `@transition_in(${name}, 1);`}
					${name}.m(${update_mount_node}, ${anchor});
				}
			`;
    	            if (dynamic) {
    	                block.chunks.update.push(b `
					if (${current_block_type} === (${current_block_type} = ${select_block_type}(#ctx, #dirty)) && ${name}) {
						${name}.p(#ctx, #dirty);
					} else {
						${change_block}
					}
				`);
    	            }
    	            else {
    	                block.chunks.update.push(b `
					if (${current_block_type} !== (${current_block_type} = ${select_block_type}(#ctx, #dirty))) {
						${change_block}
					}
				`);
    	            }
    	        }
    	        else if (dynamic) {
    	            block.chunks.update.push(b `${name}.p(#ctx, #dirty);`);
    	        }
    	        if (if_exists_condition) {
    	            block.chunks.destroy.push(b `
				if (${if_exists_condition}) {
					${name}.d(${detaching});
				}
			`);
    	        }
    	        else {
    	            block.chunks.destroy.push(b `
				${name}.d(${detaching});
			`);
    	        }
    	    }
    	    // if any of the siblings have outros, we need to keep references to the blocks
    	    // (TODO does this only apply to bidi transitions?)
    	    render_compound_with_outros(block, parent_node, _parent_nodes, dynamic, { name, anchor, has_else, has_transitions }, detaching) {
    	        const select_block_type = this.renderer.component.get_unique_name(`select_block_type`);
    	        const current_block_type_index = block.get_unique_name(`current_block_type_index`);
    	        const previous_block_index = block.get_unique_name(`previous_block_index`);
    	        const if_block_creators = block.get_unique_name(`if_block_creators`);
    	        const if_blocks = block.get_unique_name(`if_blocks`);
    	        const if_current_block_type_index = has_else
    	            ? nodes => nodes
    	            : nodes => b `if (~${current_block_type_index}) { ${nodes} }`;
    	        block.add_variable(current_block_type_index);
    	        block.add_variable(name);
    	        block.chunks.init.push(b `
			const ${if_block_creators} = [
				${this.branches.map(branch => branch.block.name)}
			];

			const ${if_blocks} = [];

			${this.needs_update
            ? b `
					function ${select_block_type}(#ctx, #dirty) {
						${this.branches.map(({ dependencies, condition, snippet }, i) => condition
                ? b `
						${snippet && (dependencies.length > 0
                    ? b `if (${block.renderer.dirty(dependencies)}) ${condition} = !!${snippet}`
                    : b `if (${condition} == -1) ${condition} = !!${snippet}`)}
						if (${condition}) return ${i};`
                : b `return ${i};`)}
						${!has_else && b `return -1;`}
					}
				`
            : b `
					function ${select_block_type}(#ctx, #dirty) {
						${this.branches.map(({ condition, snippet }, i) => condition
                ? b `if (${snippet || condition}) return ${i};`
                : b `return ${i};`)}
						${!has_else && b `return -1;`}
					}
				`}
		`);
    	        if (has_else) {
    	            block.chunks.init.push(b `
				${current_block_type_index} = ${select_block_type}(#ctx, -1);
				${name} = ${if_blocks}[${current_block_type_index}] = ${if_block_creators}[${current_block_type_index}](#ctx);
			`);
    	        }
    	        else {
    	            block.chunks.init.push(b `
				if (~(${current_block_type_index} = ${select_block_type}(#ctx, -1))) {
					${name} = ${if_blocks}[${current_block_type_index}] = ${if_block_creators}[${current_block_type_index}](#ctx);
				}
			`);
    	        }
    	        const initial_mount_node = parent_node || '#target';
    	        const anchor_node = parent_node ? 'null' : 'anchor';
    	        block.chunks.mount.push(if_current_block_type_index(b `${if_blocks}[${current_block_type_index}].m(${initial_mount_node}, ${anchor_node});`));
    	        if (this.needs_update) {
    	            const update_mount_node = this.get_update_mount_node(anchor);
    	            const destroy_old_block = b `
				@group_outros();
				@transition_out(${if_blocks}[${previous_block_index}], 1, 1, () => {
					${if_blocks}[${previous_block_index}] = null;
				});
				@check_outros();
			`;
    	            const create_new_block = b `
				${name} = ${if_blocks}[${current_block_type_index}];
				if (!${name}) {
					${name} = ${if_blocks}[${current_block_type_index}] = ${if_block_creators}[${current_block_type_index}](#ctx);
					${name}.c();
				}
				${has_transitions && b `@transition_in(${name}, 1);`}
				${name}.m(${update_mount_node}, ${anchor});
			`;
    	            const change_block = has_else
    	                ? b `
					${destroy_old_block}

					${create_new_block}
				`
    	                : b `
					if (${name}) {
						${destroy_old_block}
					}

					if (~${current_block_type_index}) {
						${create_new_block}
					} else {
						${name} = null;
					}
				`;
    	            if (dynamic) {
    	                block.chunks.update.push(b `
					let ${previous_block_index} = ${current_block_type_index};
					${current_block_type_index} = ${select_block_type}(#ctx, #dirty);
					if (${current_block_type_index} === ${previous_block_index}) {
						${if_current_block_type_index(b `${if_blocks}[${current_block_type_index}].p(#ctx, #dirty);`)}
					} else {
						${change_block}
					}
				`);
    	            }
    	            else {
    	                block.chunks.update.push(b `
					let ${previous_block_index} = ${current_block_type_index};
					${current_block_type_index} = ${select_block_type}(#ctx, #dirty);
					if (${current_block_type_index} !== ${previous_block_index}) {
						${change_block}
					}
				`);
    	            }
    	        }
    	        else if (dynamic) {
    	            block.chunks.update.push(b `${name}.p(#ctx, #dirty);`);
    	        }
    	        block.chunks.destroy.push(if_current_block_type_index(b `${if_blocks}[${current_block_type_index}].d(${detaching});`));
    	    }
    	    render_simple(block, parent_node, _parent_nodes, dynamic, { name, anchor, if_exists_condition, has_transitions }, detaching) {
    	        const branch = this.branches[0];
    	        if (branch.snippet)
    	            block.add_variable(branch.condition, branch.snippet);
    	        block.chunks.init.push(b `
			let ${name} = ${branch.condition} && ${branch.block.name}(#ctx);
		`);
    	        const initial_mount_node = parent_node || '#target';
    	        const anchor_node = parent_node ? 'null' : 'anchor';
    	        block.chunks.mount.push(b `if (${name}) ${name}.m(${initial_mount_node}, ${anchor_node});`);
    	        if (branch.dependencies.length > 0) {
    	            const update_mount_node = this.get_update_mount_node(anchor);
    	            const enter = dynamic
    	                ? b `
					if (${name}) {
						${name}.p(#ctx, #dirty);
						${has_transitions && b `@transition_in(${name}, 1);`}
					} else {
						${name} = ${branch.block.name}(#ctx);
						${name}.c();
						${has_transitions && b `@transition_in(${name}, 1);`}
						${name}.m(${update_mount_node}, ${anchor});
					}
				`
    	                : b `
					if (!${name}) {
						${name} = ${branch.block.name}(#ctx);
						${name}.c();
						${has_transitions && b `@transition_in(${name}, 1);`}
						${name}.m(${update_mount_node}, ${anchor});
					} else {
						${has_transitions && b `@transition_in(${name}, 1);`}
					}
				`;
    	            if (branch.snippet) {
    	                block.chunks.update.push(b `if (${block.renderer.dirty(branch.dependencies)}) ${branch.condition} = ${branch.snippet}`);
    	            }
    	            // no `p()` here — we don't want to update outroing nodes,
    	            // as that will typically result in glitching
    	            if (branch.block.has_outro_method) {
    	                block.chunks.update.push(b `
					if (${branch.condition}) {
						${enter}
					} else if (${name}) {
						@group_outros();
						@transition_out(${name}, 1, 1, () => {
							${name} = null;
						});
						@check_outros();
					}
				`);
    	            }
    	            else {
    	                block.chunks.update.push(b `
					if (${branch.condition}) {
						${enter}
					} else if (${name}) {
						${name}.d(1);
						${name} = null;
					}
				`);
    	            }
    	        }
    	        else if (dynamic) {
    	            block.chunks.update.push(b `
				if (${branch.condition}) ${name}.p(#ctx, #dirty);
			`);
    	        }
    	        if (if_exists_condition) {
    	            block.chunks.destroy.push(b `
				if (${if_exists_condition}) ${name}.d(${detaching});
			`);
    	        }
    	        else {
    	            block.chunks.destroy.push(b `
				${name}.d(${detaching});
			`);
    	        }
    	    }
    	}

    	function is_dynamic$1(variable) {
    	    if (variable) {
    	        if (variable.mutated || variable.reassigned)
    	            return true; // dynamic internal state
    	        if (!variable.module && variable.writable && variable.export_name)
    	            return true; // writable props
    	    }
    	    return false;
    	}

    	class InlineComponentWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.slots = new Map();
    	        this.cannot_use_innerhtml();
    	        this.not_static_content();
    	        if (this.node.expression) {
    	            block.add_dependencies(this.node.expression.dependencies);
    	        }
    	        this.node.attributes.forEach(attr => {
    	            block.add_dependencies(attr.dependencies);
    	        });
    	        this.node.bindings.forEach(binding => {
    	            if (binding.is_contextual) {
    	                // we need to ensure that the each block creates a context including
    	                // the list and the index, if they're not otherwise referenced
    	                const { name } = get_object(binding.expression.node);
    	                const each_block = this.node.scope.get_owner(name);
    	                each_block.has_binding = true;
    	            }
    	            block.add_dependencies(binding.expression.dependencies);
    	        });
    	        this.node.handlers.forEach(handler => {
    	            if (handler.expression) {
    	                block.add_dependencies(handler.expression.dependencies);
    	            }
    	        });
    	        this.var = {
    	            type: 'Identifier',
    	            name: (this.node.name === 'svelte:self' ? renderer.component.name.name :
    	                this.node.name === 'svelte:component' ? 'switch_instance' :
    	                    sanitize(this.node.name)).toLowerCase()
    	        };
    	        if (this.node.children.length) {
    	            this.node.lets.forEach(l => {
    	                extract_names(l.value || l.name).forEach(name => {
    	                    renderer.add_to_context(name, true);
    	                });
    	            });
    	            const default_slot = block.child({
    	                comment: create_debugging_comment(node, renderer.component),
    	                name: renderer.component.get_unique_name(`create_default_slot`),
    	                type: 'slot'
    	            });
    	            this.renderer.blocks.push(default_slot);
    	            this.slots.set('default', get_slot_definition(default_slot, this.node.scope, this.node.lets));
    	            this.fragment = new FragmentWrapper(renderer, default_slot, node.children, this, strip_whitespace, next_sibling);
    	            const dependencies = new Set();
    	            // TODO is this filtering necessary? (I *think* so)
    	            default_slot.dependencies.forEach(name => {
    	                if (!this.node.scope.is_let(name)) {
    	                    dependencies.add(name);
    	                }
    	            });
    	            block.add_dependencies(dependencies);
    	        }
    	        block.add_outro();
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        const { renderer } = this;
    	        const { component } = renderer;
    	        const name = this.var;
    	        const component_opts = x `{}`;
    	        const statements = [];
    	        const updates = [];
    	        let props;
    	        const name_changes = block.get_unique_name(`${name.name}_changes`);
    	        const uses_spread = !!this.node.attributes.find(a => a.is_spread);
    	        const initial_props = this.slots.size > 0
    	            ? [
    	                p `$$slots: {
					${Array.from(this.slots).map(([name, slot]) => {
                    return p `${name}: [${slot.block.name}, ${slot.get_context || null}, ${slot.get_changes || null}]`;
                })}
				}`,
    	                p `$$scope: {
					ctx: #ctx
				}`
    	            ]
    	            : [];
    	        const attribute_object = uses_spread
    	            ? x `{ ${initial_props} }`
    	            : x `{
				${this.node.attributes.map(attr => p `${attr.name}: ${attr.get_value(block)}`)},
				${initial_props}
			}`;
    	        if (this.node.attributes.length || this.node.bindings.length || initial_props.length) {
    	            if (!uses_spread && this.node.bindings.length === 0) {
    	                component_opts.properties.push(p `props: ${attribute_object}`);
    	            }
    	            else {
    	                props = block.get_unique_name(`${name.name}_props`);
    	                component_opts.properties.push(p `props: ${props}`);
    	            }
    	        }
    	        if (this.fragment) {
    	            this.renderer.add_to_context('$$scope', true);
    	            const default_slot = this.slots.get('default');
    	            this.fragment.nodes.forEach((child) => {
    	                child.render(default_slot.block, null, x `#nodes`);
    	            });
    	        }
    	        if (component.compile_options.dev) {
    	            // TODO this is a terrible hack, but without it the component
    	            // will complain that options.target is missing. This would
    	            // work better if components had separate public and private
    	            // APIs
    	            component_opts.properties.push(p `$$inline: true`);
    	        }
    	        const fragment_dependencies = new Set(this.fragment ? ['$$scope'] : []);
    	        this.slots.forEach(slot => {
    	            slot.block.dependencies.forEach(name => {
    	                const is_let = slot.scope.is_let(name);
    	                const variable = renderer.component.var_lookup.get(name);
    	                if (is_let || is_dynamic$1(variable))
    	                    fragment_dependencies.add(name);
    	            });
    	        });
    	        const non_let_dependencies = Array.from(fragment_dependencies).filter(name => !this.node.scope.is_let(name));
    	        const dynamic_attributes = this.node.attributes.filter(a => a.get_dependencies().length > 0);
    	        if (!uses_spread && (dynamic_attributes.length > 0 || this.node.bindings.length > 0 || non_let_dependencies.length > 0)) {
    	            updates.push(b `const ${name_changes} = {};`);
    	        }
    	        if (this.node.attributes.length) {
    	            if (uses_spread) {
    	                const levels = block.get_unique_name(`${this.var.name}_spread_levels`);
    	                const initial_props = [];
    	                const changes = [];
    	                const all_dependencies = new Set();
    	                this.node.attributes.forEach(attr => {
    	                    add_to_set(all_dependencies, attr.dependencies);
    	                });
    	                this.node.attributes.forEach((attr, i) => {
    	                    const { name, dependencies } = attr;
    	                    const condition = dependencies.size > 0 && (dependencies.size !== all_dependencies.size)
    	                        ? renderer.dirty(Array.from(dependencies))
    	                        : null;
    	                    if (attr.is_spread) {
    	                        const value = attr.expression.manipulate(block);
    	                        initial_props.push(value);
    	                        let value_object = value;
    	                        if (attr.expression.node.type !== 'ObjectExpression') {
    	                            value_object = x `@get_spread_object(${value})`;
    	                        }
    	                        changes.push(condition ? x `${condition} && ${value_object}` : value_object);
    	                    }
    	                    else {
    	                        const obj = x `{ ${name}: ${attr.get_value(block)} }`;
    	                        initial_props.push(obj);
    	                        changes.push(condition ? x `${condition} && ${obj}` : x `${levels}[${i}]`);
    	                    }
    	                });
    	                block.chunks.init.push(b `
					const ${levels} = [
						${initial_props}
					];
				`);
    	                statements.push(b `
					for (let #i = 0; #i < ${levels}.length; #i += 1) {
						${props} = @assign(${props}, ${levels}[#i]);
					}
				`);
    	                if (all_dependencies.size) {
    	                    const condition = renderer.dirty(Array.from(all_dependencies));
    	                    updates.push(b `
						const ${name_changes} = ${condition} ? @get_spread_update(${levels}, [
							${changes}
						]) : {}
					`);
    	                }
    	                else {
    	                    updates.push(b `
						const ${name_changes} = {};
					`);
    	                }
    	            }
    	            else {
    	                dynamic_attributes.forEach((attribute) => {
    	                    const dependencies = attribute.get_dependencies();
    	                    if (dependencies.length > 0) {
    	                        const condition = renderer.dirty(dependencies);
    	                        updates.push(b `
							if (${condition}) ${name_changes}.${attribute.name} = ${attribute.get_value(block)};
						`);
    	                    }
    	                });
    	            }
    	        }
    	        if (non_let_dependencies.length > 0) {
    	            updates.push(b `
				if (${renderer.dirty(non_let_dependencies)}) {
					${name_changes}.$$scope = { dirty: #dirty, ctx: #ctx };
				}`);
    	        }
    	        const munged_bindings = this.node.bindings.map(binding => {
    	            component.has_reactive_assignments = true;
    	            if (binding.name === 'this') {
    	                return bind_this(component, block, binding, this.var);
    	            }
    	            const id = component.get_unique_name(`${this.var.name}_${binding.name}_binding`);
    	            renderer.add_to_context(id.name);
    	            const callee = renderer.reference(id);
    	            const updating = block.get_unique_name(`updating_${binding.name}`);
    	            block.add_variable(updating);
    	            const snippet = binding.expression.manipulate(block);
    	            statements.push(b `
				if (${snippet} !== void 0) {
					${props}.${binding.name} = ${snippet};
				}`);
    	            updates.push(b `
				if (!${updating} && ${renderer.dirty(Array.from(binding.expression.dependencies))}) {
					${updating} = true;
					${name_changes}.${binding.name} = ${snippet};
					@add_flush_callback(() => ${updating} = false);
				}
			`);
    	            const contextual_dependencies = Array.from(binding.expression.contextual_dependencies);
    	            const dependencies = Array.from(binding.expression.dependencies);
    	            let lhs = binding.raw_expression;
    	            if (binding.is_contextual && binding.expression.node.type === 'Identifier') {
    	                // bind:x={y} — we can't just do `y = x`, we need to
    	                // to `array[index] = x;
    	                const { name } = binding.expression.node;
    	                const { object, property, snippet } = block.bindings.get(name);
    	                lhs = snippet;
    	                contextual_dependencies.push(object.name, property.name);
    	            }
    	            const value = block.get_unique_name('value');
    	            const params = [value];
    	            if (contextual_dependencies.length > 0) {
    	                const args = [];
    	                contextual_dependencies.forEach(name => {
    	                    params.push({
    	                        type: 'Identifier',
    	                        name
    	                    });
    	                    renderer.add_to_context(name, true);
    	                    args.push(renderer.reference(name));
    	                });
    	                block.chunks.init.push(b `
					function ${id}(${value}) {
						${callee}.call(null, ${value}, ${args});
					}
				`);
    	                block.maintain_context = true; // TODO put this somewhere more logical
    	            }
    	            else {
    	                block.chunks.init.push(b `
					function ${id}(${value}) {
						${callee}.call(null, ${value});
					}
				`);
    	            }
    	            const body = b `
				function ${id}(${params}) {
					${lhs} = ${value};
					${renderer.invalidate(dependencies[0])};
				}
			`;
    	            component.partly_hoisted.push(body);
    	            return b `@binding_callbacks.push(() => @bind(${this.var}, '${binding.name}', ${id}));`;
    	        });
    	        const munged_handlers = this.node.handlers.map(handler => {
    	            const event_handler = new EventHandlerWrapper(handler, this);
    	            let snippet = event_handler.get_snippet(block);
    	            if (handler.modifiers.has('once'))
    	                snippet = x `@once(${snippet})`;
    	            return b `${name}.$on("${handler.name}", ${snippet});`;
    	        });
    	        if (this.node.name === 'svelte:component') {
    	            const switch_value = block.get_unique_name('switch_value');
    	            const switch_props = block.get_unique_name('switch_props');
    	            const snippet = this.node.expression.manipulate(block);
    	            block.chunks.init.push(b `
				var ${switch_value} = ${snippet};

				function ${switch_props}(#ctx) {
					${(this.node.attributes.length > 0 || this.node.bindings.length > 0) && b `
					${props && b `let ${props} = ${attribute_object};`}`}
					${statements}
					return ${component_opts};
				}

				if (${switch_value}) {
					var ${name} = new ${switch_value}(${switch_props}(#ctx));

					${munged_bindings}
					${munged_handlers}
				}
			`);
    	            block.chunks.create.push(b `if (${name}) @create_component(${name}.$$.fragment);`);
    	            if (parent_nodes && this.renderer.options.hydratable) {
    	                block.chunks.claim.push(b `if (${name}) @claim_component(${name}.$$.fragment, ${parent_nodes});`);
    	            }
    	            block.chunks.mount.push(b `
				if (${name}) {
					@mount_component(${name}, ${parent_node || '#target'}, ${parent_node ? 'null' : 'anchor'});
				}
			`);
    	            const anchor = this.get_or_create_anchor(block, parent_node, parent_nodes);
    	            const update_mount_node = this.get_update_mount_node(anchor);
    	            if (updates.length) {
    	                block.chunks.update.push(b `
					${updates}
				`);
    	            }
    	            block.chunks.update.push(b `
				if (${switch_value} !== (${switch_value} = ${snippet})) {
					if (${name}) {
						@group_outros();
						const old_component = ${name};
						@transition_out(old_component.$$.fragment, 1, 0, () => {
							@destroy_component(old_component, 1);
						});
						@check_outros();
					}

					if (${switch_value}) {
						${name} = new ${switch_value}(${switch_props}(#ctx));

						${munged_bindings}
						${munged_handlers}

						@create_component(${name}.$$.fragment);
						@transition_in(${name}.$$.fragment, 1);
						@mount_component(${name}, ${update_mount_node}, ${anchor});
					} else {
						${name} = null;
					}
				} else if (${switch_value}) {
					${updates.length && b `${name}.$set(${name_changes});`}
				}
			`);
    	            block.chunks.intro.push(b `
				if (${name}) @transition_in(${name}.$$.fragment, #local);
			`);
    	            block.chunks.outro.push(b `if (${name}) @transition_out(${name}.$$.fragment, #local);`);
    	            block.chunks.destroy.push(b `if (${name}) @destroy_component(${name}, ${parent_node ? null : 'detaching'});`);
    	        }
    	        else {
    	            const expression = this.node.name === 'svelte:self'
    	                ? component.name
    	                : this.renderer.reference(this.node.name);
    	            block.chunks.init.push(b `
				${(this.node.attributes.length > 0 || this.node.bindings.length > 0) && b `
				${props && b `let ${props} = ${attribute_object};`}`}
				${statements}
				const ${name} = new ${expression}(${component_opts});

				${munged_bindings}
				${munged_handlers}
			`);
    	            block.chunks.create.push(b `@create_component(${name}.$$.fragment);`);
    	            if (parent_nodes && this.renderer.options.hydratable) {
    	                block.chunks.claim.push(b `@claim_component(${name}.$$.fragment, ${parent_nodes});`);
    	            }
    	            block.chunks.mount.push(b `@mount_component(${name}, ${parent_node || '#target'}, ${parent_node ? 'null' : 'anchor'});`);
    	            block.chunks.intro.push(b `
				@transition_in(${name}.$$.fragment, #local);
			`);
    	            if (updates.length) {
    	                block.chunks.update.push(b `
					${updates}
					${name}.$set(${name_changes});
				`);
    	            }
    	            block.chunks.destroy.push(b `
				@destroy_component(${name}, ${parent_node ? null : 'detaching'});
			`);
    	            block.chunks.outro.push(b `@transition_out(${name}.$$.fragment, #local);`);
    	        }
    	    }
    	}

    	class Tag extends Wrapper {
    	    constructor(renderer, block, parent, node) {
    	        super(renderer, block, parent, node);
    	        this.cannot_use_innerhtml();
    	        if (!this.is_dependencies_static()) {
    	            this.not_static_content();
    	        }
    	        block.add_dependencies(node.expression.dependencies);
    	    }
    	    is_dependencies_static() {
    	        return this.node.expression.contextual_dependencies.size === 0 && this.node.expression.dynamic_dependencies().length === 0;
    	    }
    	    rename_this_method(block, update) {
    	        const dependencies = this.node.expression.dynamic_dependencies();
    	        let snippet = this.node.expression.manipulate(block);
    	        const value = this.node.should_cache && block.get_unique_name(`${this.var.name}_value`);
    	        const content = this.node.should_cache ? value : snippet;
    	        snippet = x `${snippet} + ""`;
    	        if (this.node.should_cache)
    	            block.add_variable(value, snippet); // TODO may need to coerce snippet to string
    	        if (dependencies.length > 0) {
    	            let condition = block.renderer.dirty(dependencies);
    	            if (block.has_outros) {
    	                condition = x `!#current || ${condition}`;
    	            }
    	            const update_cached_value = x `${value} !== (${value} = ${snippet})`;
    	            if (this.node.should_cache) {
    	                condition = x `${condition} && ${update_cached_value}`;
    	            }
    	            block.chunks.update.push(b `if (${condition}) ${update(content)}`);
    	        }
    	        return { init: content };
    	    }
    	}

    	class MustacheTagWrapper extends Tag {
    	    constructor(renderer, block, parent, node) {
    	        super(renderer, block, parent, node);
    	        this.var = { type: 'Identifier', name: 't' };
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        const { init } = this.rename_this_method(block, value => x `@set_data(${this.var}, ${value});`);
    	        block.add_element(this.var, x `@text(${init})`, parent_nodes && x `@claim_text(${parent_nodes}, ${init})`, parent_node);
    	    }
    	}

    	class RawMustacheTagWrapper extends Tag {
    	    constructor(renderer, block, parent, node) {
    	        super(renderer, block, parent, node);
    	        this.var = { type: 'Identifier', name: 'raw' };
    	        this.cannot_use_innerhtml();
    	        this.not_static_content();
    	    }
    	    render(block, parent_node, _parent_nodes) {
    	        const in_head = is_head(parent_node);
    	        const can_use_innerhtml = !in_head && parent_node && !this.prev && !this.next;
    	        if (can_use_innerhtml) {
    	            const insert = content => b `${parent_node}.innerHTML = ${content};`[0];
    	            const { init } = this.rename_this_method(block, content => insert(content));
    	            block.chunks.mount.push(insert(init));
    	        }
    	        else {
    	            const needs_anchor = in_head || (this.next && !this.next.is_dom_node());
    	            const html_tag = block.get_unique_name('html_tag');
    	            const html_anchor = needs_anchor && block.get_unique_name('html_anchor');
    	            block.add_variable(html_tag);
    	            const { init } = this.rename_this_method(block, content => x `${html_tag}.p(${content});`);
    	            const update_anchor = in_head ? 'null' : needs_anchor ? html_anchor : this.next ? this.next.var : 'null';
    	            block.chunks.hydrate.push(b `${html_tag} = new @HtmlTag(${init}, ${update_anchor});`);
    	            block.chunks.mount.push(b `${html_tag}.m(${parent_node || '#target'}, ${parent_node ? null : 'anchor'});`);
    	            if (needs_anchor) {
    	                block.add_element(html_anchor, x `@empty()`, x `@empty()`, parent_node);
    	            }
    	            if (!parent_node || in_head) {
    	                block.chunks.destroy.push(b `if (detaching) ${html_tag}.d();`);
    	            }
    	        }
    	    }
    	}

    	function get_slot_data(values, block = null) {
    	    return {
    	        type: 'ObjectExpression',
    	        properties: Array.from(values.values())
    	            .filter(attribute => attribute.name !== 'name')
    	            .map(attribute => {
    	            const value = get_value(block, attribute);
    	            return p `${attribute.name}: ${value}`;
    	        })
    	    };
    	}
    	function get_value(block, attribute) {
    	    if (attribute.is_true)
    	        return x `true`;
    	    if (attribute.chunks.length === 0)
    	        return x `""`;
    	    let value = attribute.chunks
    	        .map(chunk => chunk.type === 'Text' ? string_literal(chunk.data) : (block ? chunk.manipulate(block) : chunk.node))
    	        .reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	    if (attribute.chunks.length > 1 && attribute.chunks[0].type !== 'Text') {
    	        value = x `"" + ${value}`;
    	    }
    	    return value;
    	}

    	class SlotWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, strip_whitespace, next_sibling) {
    	        super(renderer, block, parent, node);
    	        this.var = { type: 'Identifier', name: 'slot' };
    	        this.dependencies = new Set(['$$scope']);
    	        this.cannot_use_innerhtml();
    	        this.not_static_content();
    	        this.fragment = new FragmentWrapper(renderer, block, node.children, parent, strip_whitespace, next_sibling);
    	        this.node.values.forEach(attribute => {
    	            add_to_set(this.dependencies, attribute.dependencies);
    	        });
    	        block.add_dependencies(this.dependencies);
    	        // we have to do this, just in case
    	        block.add_intro();
    	        block.add_outro();
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        const { renderer } = this;
    	        const { slot_name } = this.node;
    	        let get_slot_changes_fn;
    	        let get_slot_context_fn;
    	        if (this.node.values.size > 0) {
    	            get_slot_changes_fn = renderer.component.get_unique_name(`get_${sanitize(slot_name)}_slot_changes`);
    	            get_slot_context_fn = renderer.component.get_unique_name(`get_${sanitize(slot_name)}_slot_context`);
    	            const changes = x `{}`;
    	            const dependencies = new Set();
    	            this.node.values.forEach(attribute => {
    	                attribute.chunks.forEach(chunk => {
    	                    if (chunk.dependencies) {
    	                        add_to_set(dependencies, chunk.contextual_dependencies);
    	                        // add_to_set(dependencies, (chunk as Expression).dependencies);
    	                        chunk.dependencies.forEach(name => {
    	                            const variable = renderer.component.var_lookup.get(name);
    	                            if (variable && !variable.hoistable)
    	                                dependencies.add(name);
    	                        });
    	                    }
    	                });
    	                const dynamic_dependencies = Array.from(attribute.dependencies).filter(name => {
    	                    if (this.node.scope.is_let(name))
    	                        return true;
    	                    const variable = renderer.component.var_lookup.get(name);
    	                    return is_dynamic$1(variable);
    	                });
    	                if (dynamic_dependencies.length > 0) {
    	                    changes.properties.push(p `${attribute.name}: ${renderer.dirty(dynamic_dependencies)}`);
    	                }
    	            });
    	            renderer.blocks.push(b `
				const ${get_slot_changes_fn} = #dirty => ${changes};
				const ${get_slot_context_fn} = #ctx => ${get_slot_data(this.node.values, block)};
			`);
    	        }
    	        else {
    	            get_slot_changes_fn = 'null';
    	            get_slot_context_fn = 'null';
    	        }
    	        const slot = block.get_unique_name(`${sanitize(slot_name)}_slot`);
    	        const slot_definition = block.get_unique_name(`${sanitize(slot_name)}_slot_template`);
    	        block.chunks.init.push(b `
			const ${slot_definition} = ${renderer.reference('$$slots')}.${slot_name};
			const ${slot} = @create_slot(${slot_definition}, #ctx, ${renderer.reference('$$scope')}, ${get_slot_context_fn});
		`);
    	        // TODO this is a dreadful hack! Should probably make this nicer
    	        const { create, claim, hydrate, mount, update, destroy } = block.chunks;
    	        block.chunks.create = [];
    	        block.chunks.claim = [];
    	        block.chunks.hydrate = [];
    	        block.chunks.mount = [];
    	        block.chunks.update = [];
    	        block.chunks.destroy = [];
    	        const listeners = block.event_listeners;
    	        block.event_listeners = [];
    	        this.fragment.render(block, parent_node, parent_nodes);
    	        block.render_listeners(`_${slot.name}`);
    	        block.event_listeners = listeners;
    	        if (block.chunks.create.length)
    	            create.push(b `if (!${slot}) { ${block.chunks.create} }`);
    	        if (block.chunks.claim.length)
    	            claim.push(b `if (!${slot}) { ${block.chunks.claim} }`);
    	        if (block.chunks.hydrate.length)
    	            hydrate.push(b `if (!${slot}) { ${block.chunks.hydrate} }`);
    	        if (block.chunks.mount.length)
    	            mount.push(b `if (!${slot}) { ${block.chunks.mount} }`);
    	        if (block.chunks.update.length)
    	            update.push(b `if (!${slot}) { ${block.chunks.update} }`);
    	        if (block.chunks.destroy.length)
    	            destroy.push(b `if (!${slot}) { ${block.chunks.destroy} }`);
    	        block.chunks.create = create;
    	        block.chunks.claim = claim;
    	        block.chunks.hydrate = hydrate;
    	        block.chunks.mount = mount;
    	        block.chunks.update = update;
    	        block.chunks.destroy = destroy;
    	        block.chunks.create.push(b `if (${slot}) ${slot}.c();`);
    	        if (renderer.options.hydratable) {
    	            block.chunks.claim.push(b `if (${slot}) ${slot}.l(${parent_nodes});`);
    	        }
    	        block.chunks.mount.push(b `
			if (${slot}) {
				${slot}.m(${parent_node || '#target'}, ${parent_node ? 'null' : 'anchor'});
			}
		`);
    	        block.chunks.intro.push(b `@transition_in(${slot}, #local);`);
    	        block.chunks.outro.push(b `@transition_out(${slot}, #local);`);
    	        const dynamic_dependencies = Array.from(this.dependencies).filter(name => {
    	            if (name === '$$scope')
    	                return true;
    	            if (this.node.scope.is_let(name))
    	                return true;
    	            const variable = renderer.component.var_lookup.get(name);
    	            return is_dynamic$1(variable);
    	        });
    	        block.chunks.update.push(b `
			if (${slot} && ${slot}.p && ${renderer.dirty(dynamic_dependencies)}) {
				${slot}.p(
					@get_slot_context(${slot_definition}, #ctx, ${renderer.reference('$$scope')}, ${get_slot_context_fn}),
					@get_slot_changes(${slot_definition}, ${renderer.reference('$$scope')}, #dirty, ${get_slot_changes_fn})
				);
			}
		`);
    	        block.chunks.destroy.push(b `if (${slot}) ${slot}.d(detaching);`);
    	    }
    	}

    	// Whitespace inside one of these elements will not result in
    	// a whitespace node being created in any circumstances. (This
    	// list is almost certainly very incomplete)
    	const elements_without_text = new Set([
    	    'audio',
    	    'datalist',
    	    'dl',
    	    'optgroup',
    	    'select',
    	    'video',
    	]);
    	// TODO this should probably be in Fragment
    	function should_skip$1(node) {
    	    if (/\S/.test(node.data))
    	        return false;
    	    const parent_element = node.find_nearest(/(?:Element|InlineComponent|Head)/);
    	    if (!parent_element)
    	        return false;
    	    if (parent_element.type === 'Head')
    	        return true;
    	    if (parent_element.type === 'InlineComponent')
    	        return parent_element.children.length === 1 && node === parent_element.children[0];
    	    return parent_element.namespace || elements_without_text.has(parent_element.name);
    	}
    	class TextWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, data) {
    	        super(renderer, block, parent, node);
    	        this.skip = should_skip$1(this.node);
    	        this.data = data;
    	        this.var = (this.skip ? null : x `t`);
    	    }
    	    use_space() {
    	        if (this.renderer.component.component_options.preserveWhitespace)
    	            return false;
    	        if (/[\S\u00A0]/.test(this.data))
    	            return false;
    	        let node = this.parent && this.parent.node;
    	        while (node) {
    	            if (node.type === 'Element' && node.name === 'pre') {
    	                return false;
    	            }
    	            node = node.parent;
    	        }
    	        return true;
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        if (this.skip)
    	            return;
    	        const use_space = this.use_space();
    	        block.add_element(this.var, use_space ? x `@space()` : x `@text("${this.data}")`, parent_nodes && (use_space ? x `@claim_space(${parent_nodes})` : x `@claim_text(${parent_nodes}, "${this.data}")`), parent_node);
    	    }
    	}

    	class TitleWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node, _strip_whitespace, _next_sibling) {
    	        super(renderer, block, parent, node);
    	    }
    	    render(block, _parent_node, _parent_nodes) {
    	        const is_dynamic = !!this.node.children.find(node => node.type !== 'Text');
    	        if (is_dynamic) {
    	            let value;
    	            const all_dependencies = new Set();
    	            // TODO some of this code is repeated in Tag.ts — would be good to
    	            // DRY it out if that's possible without introducing crazy indirection
    	            if (this.node.children.length === 1) {
    	                // single {tag} — may be a non-string
    	                // @ts-ignore todo: check this
    	                const { expression } = this.node.children[0];
    	                value = expression.manipulate(block);
    	                add_to_set(all_dependencies, expression.dependencies);
    	            }
    	            else {
    	                // '{foo} {bar}' — treat as string concatenation
    	                value = this.node.children
    	                    .map(chunk => {
    	                    if (chunk.type === 'Text')
    	                        return string_literal(chunk.data);
    	                    chunk.expression.dependencies.forEach(d => {
    	                        all_dependencies.add(d);
    	                    });
    	                    return chunk.expression.manipulate(block);
    	                })
    	                    .reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	                if (this.node.children[0].type !== 'Text') {
    	                    value = x `"" + ${value}`;
    	                }
    	            }
    	            const last = this.node.should_cache && block.get_unique_name(`title_value`);
    	            if (this.node.should_cache)
    	                block.add_variable(last);
    	            const init = this.node.should_cache ? x `${last} = ${value}` : value;
    	            block.chunks.init.push(b `@_document.title = ${init};`);
    	            const updater = b `@_document.title = ${this.node.should_cache ? last : value};`;
    	            if (all_dependencies.size) {
    	                const dependencies = Array.from(all_dependencies);
    	                let condition = block.renderer.dirty(dependencies);
    	                if (block.has_outros) {
    	                    condition = x `!#current || ${condition}`;
    	                }
    	                if (this.node.should_cache) {
    	                    condition = x `${condition} && (${last} !== (${last} = ${value}))`;
    	                }
    	                block.chunks.update.push(b `
					if (${condition}) {
						${updater}
					}`);
    	            }
    	        }
    	        else {
    	            const value = this.node.children.length > 0
    	                ? string_literal(this.node.children[0].data)
    	                : x `""`;
    	            block.chunks.hydrate.push(b `@_document.title = ${value};`);
    	        }
    	    }
    	}

    	const associated_events = {
    	    innerWidth: 'resize',
    	    innerHeight: 'resize',
    	    outerWidth: 'resize',
    	    outerHeight: 'resize',
    	    scrollX: 'scroll',
    	    scrollY: 'scroll',
    	};
    	const properties = {
    	    scrollX: 'pageXOffset',
    	    scrollY: 'pageYOffset'
    	};
    	const readonly = new Set([
    	    'innerWidth',
    	    'innerHeight',
    	    'outerWidth',
    	    'outerHeight',
    	    'online',
    	]);
    	class WindowWrapper extends Wrapper {
    	    constructor(renderer, block, parent, node) {
    	        super(renderer, block, parent, node);
    	        this.handlers = this.node.handlers.map(handler => new EventHandlerWrapper(handler, this));
    	    }
    	    render(block, _parent_node, _parent_nodes) {
    	        const { renderer } = this;
    	        const { component } = renderer;
    	        const events = {};
    	        const bindings = {};
    	        add_actions(block, '@_window', this.node.actions);
    	        add_event_handlers(block, '@_window', this.handlers);
    	        this.node.bindings.forEach(binding => {
    	            // in dev mode, throw if read-only values are written to
    	            if (readonly.has(binding.name)) {
    	                renderer.readonly.add(binding.expression.node.name);
    	            }
    	            bindings[binding.name] = binding.expression.node.name;
    	            // bind:online is a special case, we need to listen for two separate events
    	            if (binding.name === 'online')
    	                return;
    	            const associated_event = associated_events[binding.name];
    	            const property = properties[binding.name] || binding.name;
    	            if (!events[associated_event])
    	                events[associated_event] = [];
    	            events[associated_event].push({
    	                name: binding.expression.node.name,
    	                value: property
    	            });
    	        });
    	        const scrolling = block.get_unique_name(`scrolling`);
    	        const clear_scrolling = block.get_unique_name(`clear_scrolling`);
    	        const scrolling_timeout = block.get_unique_name(`scrolling_timeout`);
    	        Object.keys(events).forEach(event => {
    	            const id = block.get_unique_name(`onwindow${event}`);
    	            const props = events[event];
    	            renderer.add_to_context(id.name);
    	            const fn = renderer.reference(id.name);
    	            if (event === 'scroll') {
    	                // TODO other bidirectional bindings...
    	                block.add_variable(scrolling, x `false`);
    	                block.add_variable(clear_scrolling, x `() => { ${scrolling} = false }`);
    	                block.add_variable(scrolling_timeout);
    	                const condition = bindings.scrollX && bindings.scrollY
    	                    ? x `"${bindings.scrollX}" in this._state || "${bindings.scrollY}" in this._state`
    	                    : x `"${bindings.scrollX || bindings.scrollY}" in this._state`;
    	                const scrollX = bindings.scrollX && x `this._state.${bindings.scrollX}`;
    	                const scrollY = bindings.scrollY && x `this._state.${bindings.scrollY}`;
    	                renderer.meta_bindings.push(b `
					if (${condition}) {
						@_scrollTo(${scrollX || '@_window.pageXOffset'}, ${scrollY || '@_window.pageYOffset'});
					}
					${scrollX && `${scrollX} = @_window.pageXOffset;`}
					${scrollY && `${scrollY} = @_window.pageYOffset;`}
				`);
    	                block.event_listeners.push(x `
					@listen(@_window, "${event}", () => {
						${scrolling} = true;
						@_clearTimeout(${scrolling_timeout});
						${scrolling_timeout} = @_setTimeout(${clear_scrolling}, 100);
						${fn}();
					})
				`);
    	            }
    	            else {
    	                props.forEach(prop => {
    	                    renderer.meta_bindings.push(b `this._state.${prop.name} = @_window.${prop.value};`);
    	                });
    	                block.event_listeners.push(x `
					@listen(@_window, "${event}", ${fn})
				`);
    	            }
    	            component.partly_hoisted.push(b `
				function ${id}() {
					${props.map(prop => renderer.invalidate(prop.name, x `${prop.name} = @_window.${prop.value}`))}
				}
			`);
    	            block.chunks.init.push(b `
				@add_render_callback(${fn});
			`);
    	            component.has_reactive_assignments = true;
    	        });
    	        // special case... might need to abstract this out if we add more special cases
    	        if (bindings.scrollX || bindings.scrollY) {
    	            const condition = renderer.dirty([bindings.scrollX, bindings.scrollY].filter(Boolean));
    	            const scrollX = bindings.scrollX ? renderer.reference(bindings.scrollX) : x `@_window.pageXOffset`;
    	            const scrollY = bindings.scrollY ? renderer.reference(bindings.scrollY) : x `@_window.pageYOffset`;
    	            block.chunks.update.push(b `
				if (${condition} && !${scrolling}) {
					${scrolling} = true;
					@_clearTimeout(${scrolling_timeout});
					@_scrollTo(${scrollX}, ${scrollY});
					${scrolling_timeout} = @_setTimeout(${clear_scrolling}, 100);
				}
			`);
    	        }
    	        // another special case. (I'm starting to think these are all special cases.)
    	        if (bindings.online) {
    	            const id = block.get_unique_name(`onlinestatuschanged`);
    	            const name = bindings.online;
    	            renderer.add_to_context(id.name);
    	            const reference = renderer.reference(id.name);
    	            component.partly_hoisted.push(b `
				function ${id}() {
					${renderer.invalidate(name, x `${name} = @_navigator.onLine`)}
				}
			`);
    	            block.chunks.init.push(b `
				@add_render_callback(${reference});
			`);
    	            block.event_listeners.push(x `@listen(@_window, "online", ${reference})`, x `@listen(@_window, "offline", ${reference})`);
    	            component.has_reactive_assignments = true;
    	        }
    	    }
    	}

    	const wrappers = {
    	    AwaitBlock: AwaitBlockWrapper,
    	    Body: BodyWrapper,
    	    Comment: null,
    	    DebugTag: DebugTagWrapper,
    	    EachBlock: EachBlockWrapper,
    	    Element: ElementWrapper,
    	    Head: HeadWrapper,
    	    IfBlock: IfBlockWrapper,
    	    InlineComponent: InlineComponentWrapper,
    	    MustacheTag: MustacheTagWrapper,
    	    Options: null,
    	    RawMustacheTag: RawMustacheTagWrapper,
    	    Slot: SlotWrapper,
    	    Text: TextWrapper,
    	    Title: TitleWrapper,
    	    Window: WindowWrapper
    	};
    	function link(next, prev) {
    	    prev.next = next;
    	    if (next)
    	        next.prev = prev;
    	}
    	function trimmable_at(child, next_sibling) {
    	    // Whitespace is trimmable if one of the following is true:
    	    // The child and its sibling share a common nearest each block (not at an each block boundary)
    	    // The next sibling's previous node is an each block
    	    return (next_sibling.node.find_nearest(/EachBlock/) === child.find_nearest(/EachBlock/)) || next_sibling.node.prev.type === 'EachBlock';
    	}
    	class FragmentWrapper {
    	    constructor(renderer, block, nodes, parent, strip_whitespace, next_sibling) {
    	        this.nodes = [];
    	        let last_child;
    	        let window_wrapper;
    	        let i = nodes.length;
    	        while (i--) {
    	            const child = nodes[i];
    	            if (!child.type) {
    	                throw new Error(`missing type`);
    	            }
    	            if (!(child.type in wrappers)) {
    	                throw new Error(`TODO implement ${child.type}`);
    	            }
    	            // special case — this is an easy way to remove whitespace surrounding
    	            // <svelte:window/>. lil hacky but it works
    	            if (child.type === 'Window') {
    	                window_wrapper = new WindowWrapper(renderer, block, parent, child);
    	                continue;
    	            }
    	            if (child.type === 'Text') {
    	                let { data } = child;
    	                // We want to remove trailing whitespace inside an element/component/block,
    	                // *unless* there is no whitespace between this node and its next sibling
    	                if (this.nodes.length === 0) {
    	                    const should_trim = (next_sibling ? (next_sibling.node.type === 'Text' && /^\s/.test(next_sibling.node.data) && trimmable_at(child, next_sibling)) : !child.has_ancestor('EachBlock'));
    	                    if (should_trim) {
    	                        data = trim_end(data);
    	                        if (!data)
    	                            continue;
    	                    }
    	                }
    	                // glue text nodes (which could e.g. be separated by comments) together
    	                if (last_child && last_child.node.type === 'Text') {
    	                    last_child.data = data + last_child.data;
    	                    continue;
    	                }
    	                const wrapper = new TextWrapper(renderer, block, parent, child, data);
    	                if (wrapper.skip)
    	                    continue;
    	                this.nodes.unshift(wrapper);
    	                link(last_child, last_child = wrapper);
    	            }
    	            else {
    	                const Wrapper = wrappers[child.type];
    	                if (!Wrapper)
    	                    continue;
    	                const wrapper = new Wrapper(renderer, block, parent, child, strip_whitespace, last_child || next_sibling);
    	                this.nodes.unshift(wrapper);
    	                link(last_child, last_child = wrapper);
    	            }
    	        }
    	        if (strip_whitespace) {
    	            const first = this.nodes[0];
    	            if (first && first.node.type === 'Text') {
    	                first.data = trim_start(first.data);
    	                if (!first.data) {
    	                    first.var = null;
    	                    this.nodes.shift();
    	                    if (this.nodes[0]) {
    	                        this.nodes[0].prev = null;
    	                    }
    	                }
    	            }
    	        }
    	        if (window_wrapper) {
    	            this.nodes.unshift(window_wrapper);
    	            link(last_child, window_wrapper);
    	        }
    	    }
    	    render(block, parent_node, parent_nodes) {
    	        for (let i = 0; i < this.nodes.length; i += 1) {
    	            this.nodes[i].render(block, parent_node, parent_nodes);
    	        }
    	    }
    	}

    	class Renderer {
    	    constructor(component, options) {
    	        this.context = [];
    	        this.context_lookup = new Map();
    	        this.blocks = [];
    	        this.readonly = new Set();
    	        this.meta_bindings = []; // initial values for e.g. window.innerWidth, if there's a <svelte:window> meta tag
    	        this.binding_groups = [];
    	        this.component = component;
    	        this.options = options;
    	        this.locate = component.locate; // TODO messy
    	        this.file_var = options.dev && this.component.get_unique_name('file');
    	        component.vars.filter(v => !v.hoistable || (v.export_name && !v.module)).forEach(v => this.add_to_context(v.name));
    	        // ensure store values are included in context
    	        component.vars.filter(v => v.subscribable).forEach(v => this.add_to_context(`$${v.name}`));
    	        if (component.var_lookup.has('$$props')) {
    	            this.add_to_context('$$props');
    	        }
    	        if (component.slots.size > 0) {
    	            this.add_to_context('$$scope');
    	            this.add_to_context('$$slots');
    	        }
    	        if (this.binding_groups.length > 0) {
    	            this.add_to_context('$$binding_groups');
    	        }
    	        // main block
    	        this.block = new Block$1({
    	            renderer: this,
    	            name: null,
    	            type: 'component',
    	            key: null,
    	            bindings: new Map(),
    	            dependencies: new Set(),
    	        });
    	        this.block.has_update_method = true;
    	        this.fragment = new FragmentWrapper(this, this.block, component.fragment.children, null, true, null);
    	        this.context_overflow = this.context.length > 31;
    	        // TODO messy
    	        this.blocks.forEach(block => {
    	            if (block instanceof Block$1) {
    	                block.assign_variable_names();
    	            }
    	        });
    	        this.block.assign_variable_names();
    	        this.fragment.render(this.block, null, x `#nodes`);
    	        this.context.forEach(member => {
    	            const { variable } = member;
    	            if (variable) {
    	                member.priority += 2;
    	                if (variable.mutated || variable.reassigned)
    	                    member.priority += 4;
    	                // these determine whether variable is included in initial context
    	                // array, so must have the highest priority
    	                if (variable.export_name)
    	                    member.priority += 8;
    	                if (variable.referenced)
    	                    member.priority += 16;
    	            }
    	            if (!member.is_contextual) {
    	                member.priority += 1;
    	            }
    	        });
    	        this.context.sort((a, b) => (b.priority - a.priority) || (a.index.value - b.index.value));
    	        this.context.forEach((member, i) => member.index.value = i);
    	    }
    	    add_to_context(name, contextual = false) {
    	        if (!this.context_lookup.has(name)) {
    	            const member = {
    	                name,
    	                index: { type: 'Literal', value: this.context.length },
    	                is_contextual: false,
    	                is_non_contextual: false,
    	                variable: null,
    	                priority: 0
    	            };
    	            this.context_lookup.set(name, member);
    	            this.context.push(member);
    	        }
    	        const member = this.context_lookup.get(name);
    	        if (contextual) {
    	            member.is_contextual = true;
    	        }
    	        else {
    	            member.is_non_contextual = true;
    	            const variable = this.component.var_lookup.get(name);
    	            member.variable = variable;
    	        }
    	        return member;
    	    }
    	    invalidate(name, value) {
    	        const variable = this.component.var_lookup.get(name);
    	        const member = this.context_lookup.get(name);
    	        if (variable && (variable.subscribable && (variable.reassigned || variable.export_name))) {
    	            return x `${`$$subscribe_${name}`}($$invalidate(${member.index}, ${value || name}))`;
    	        }
    	        if (name[0] === '$' && name[1] !== '$') {
    	            return x `${name.slice(1)}.set(${value || name})`;
    	        }
    	        if (variable &&
    	            !variable.referenced &&
    	            !variable.is_reactive_dependency &&
    	            !variable.export_name &&
    	            !name.startsWith('$$')) {
    	            return value || name;
    	        }
    	        if (value) {
    	            return x `$$invalidate(${member.index}, ${value})`;
    	        }
    	        // if this is a reactive declaration, invalidate dependencies recursively
    	        const deps = new Set([name]);
    	        deps.forEach(name => {
    	            const reactive_declarations = this.component.reactive_declarations.filter(x => x.assignees.has(name));
    	            reactive_declarations.forEach(declaration => {
    	                declaration.dependencies.forEach(name => {
    	                    deps.add(name);
    	                });
    	            });
    	        });
    	        // TODO ideally globals etc wouldn't be here in the first place
    	        const filtered = Array.from(deps).filter(n => this.context_lookup.has(n));
    	        if (!filtered.length)
    	            return null;
    	        return filtered
    	            .map(n => x `$$invalidate(${this.context_lookup.get(n).index}, ${n})`)
    	            .reduce((lhs, rhs) => x `${lhs}, ${rhs}}`);
    	    }
    	    dirty(names, is_reactive_declaration = false) {
    	        const renderer = this;
    	        const dirty = (is_reactive_declaration
    	            ? x `$$self.$$.dirty`
    	            : x `#dirty`);
    	        const get_bitmask = () => names.reduce((bitmask, name) => {
    	            const member = renderer.context_lookup.get(name);
    	            if (!member)
    	                return bitmask;
    	            if (member.index.value === -1) {
    	                throw new Error(`unset index`);
    	            }
    	            const value = member.index.value;
    	            const i = (value / 31) | 0;
    	            const n = 1 << (value % 31);
    	            if (!bitmask[i])
    	                bitmask[i] = { n: 0, names: [] };
    	            bitmask[i].n |= n;
    	            bitmask[i].names.push(name);
    	            return bitmask;
    	        }, Array((this.context.length / 31) | 0).fill(null));
    	        let operator;
    	        let left;
    	        let right;
    	        return {
    	            get type() {
    	                // we make the type a getter, even though it's always
    	                // a BinaryExpression, because it gives us an opportunity
    	                // to lazily create the node. TODO would be better if
    	                // context was determined before rendering, so that
    	                // this indirection was unnecessary
    	                const bitmask = get_bitmask();
    	                if (renderer.context_overflow) {
    	                    const expression = bitmask
    	                        .map((b, i) => ({ b, i }))
    	                        .filter(({ b }) => b)
    	                        .map(({ b, i }) => x `${dirty}[${i}] & /*${b.names.join(', ')}*/ ${b.n}`)
    	                        .reduce((lhs, rhs) => x `${lhs} | ${rhs}`);
    	                    ({ operator, left, right } = expression);
    	                }
    	                else {
    	                    ({ operator, left, right } = x `${dirty} & /*${names.join(', ')}*/ ${bitmask[0] ? bitmask[0].n : 0}`); // TODO the `: 0` case should never apply
    	                }
    	                return 'BinaryExpression';
    	            },
    	            get operator() {
    	                return operator;
    	            },
    	            get left() {
    	                return left;
    	            },
    	            get right() {
    	                return right;
    	            }
    	        };
    	    }
    	    reference(node) {
    	        if (typeof node === 'string') {
    	            node = { type: 'Identifier', name: node };
    	        }
    	        const { name, nodes } = flatten_reference(node);
    	        const member = this.context_lookup.get(name);
    	        // TODO is this correct?
    	        if (this.component.var_lookup.get(name)) {
    	            this.component.add_reference(name);
    	        }
    	        if (member !== undefined) {
    	            const replacement = x `/*${member.name}*/ #ctx[${member.index}]`;
    	            if (nodes[0].loc)
    	                replacement.object.loc = nodes[0].loc;
    	            nodes[0] = replacement;
    	            return nodes.reduce((lhs, rhs) => x `${lhs}.${rhs}`);
    	        }
    	        return node;
    	    }
    	}

    	function create_scopes(expression) {
    	    return analyze(expression);
    	}

    	function nodes_match(a, b) {
    	    if (!!a !== !!b)
    	        return false;
    	    if (Array.isArray(a) !== Array.isArray(b))
    	        return false;
    	    if (a && typeof a === 'object') {
    	        if (Array.isArray(a)) {
    	            if (a.length !== b.length)
    	                return false;
    	            return a.every((child, i) => nodes_match(child, b[i]));
    	        }
    	        const a_keys = Object.keys(a).sort();
    	        const b_keys = Object.keys(b).sort();
    	        if (a_keys.length !== b_keys.length)
    	            return false;
    	        let i = a_keys.length;
    	        while (i--) {
    	            const key = a_keys[i];
    	            if (b_keys[i] !== key)
    	                return false;
    	            if (key === 'start' || key === 'end')
    	                continue;
    	            if (!nodes_match(a[key], b[key])) {
    	                return false;
    	            }
    	        }
    	        return true;
    	    }
    	    return a === b;
    	}

    	function invalidate(renderer, scope, node, names) {
    	    const { component } = renderer;
    	    const [head, ...tail] = Array.from(names).filter(name => {
    	        const owner = scope.find_owner(name);
    	        if (owner && owner !== component.instance_scope)
    	            return false;
    	        const variable = component.var_lookup.get(name);
    	        return variable && (!variable.hoistable &&
    	            !variable.global &&
    	            !variable.module &&
    	            (variable.referenced ||
    	                variable.subscribable ||
    	                variable.is_reactive_dependency ||
    	                variable.export_name ||
    	                variable.name[0] === '$'));
    	    });
    	    if (head) {
    	        component.has_reactive_assignments = true;
    	        if (node.type === 'AssignmentExpression' && node.operator === '=' && nodes_match(node.left, node.right) && tail.length === 0) {
    	            return renderer.invalidate(head);
    	        }
    	        else {
    	            const is_store_value = head[0] === '$';
    	            const variable = component.var_lookup.get(head);
    	            const extra_args = tail.map(name => renderer.invalidate(name));
    	            const pass_value = (extra_args.length > 0 ||
    	                (node.type === 'AssignmentExpression' && node.left.type !== 'Identifier') ||
    	                (node.type === 'UpdateExpression' && !node.prefix));
    	            if (pass_value) {
    	                extra_args.unshift({
    	                    type: 'Identifier',
    	                    name: head
    	                });
    	            }
    	            let invalidate = is_store_value
    	                ? x `@set_store_value(${head.slice(1)}, ${node}, ${extra_args})`
    	                : x `$$invalidate(${renderer.context_lookup.get(head).index}, ${node}, ${extra_args})`;
    	            if (variable.subscribable && variable.reassigned) {
    	                const subscribe = `$$subscribe_${head}`;
    	                invalidate = x `${subscribe}(${invalidate})}`;
    	            }
    	            return invalidate;
    	        }
    	    }
    	    return node;
    	}

    	function dom(component, options) {
    	    const { name } = component;
    	    const renderer = new Renderer(component, options);
    	    const { block } = renderer;
    	    block.has_outro_method = true;
    	    // prevent fragment being created twice (#1063)
    	    if (options.customElement)
    	        block.chunks.create.push(b `this.c = @noop;`);
    	    const body = [];
    	    if (renderer.file_var) {
    	        const file = component.file ? x `"${component.file}"` : x `undefined`;
    	        body.push(b `const ${renderer.file_var} = ${file};`);
    	    }
    	    const css = component.stylesheet.render(options.filename, !options.customElement);
    	    const styles = component.stylesheet.has_styles && options.dev
    	        ? `${css.code}\n/*# sourceMappingURL=${css.map.toUrl()} */`
    	        : css.code;
    	    const add_css = component.get_unique_name('add_css');
    	    const should_add_css = (!options.customElement &&
    	        !!styles &&
    	        options.css !== false);
    	    if (should_add_css) {
    	        body.push(b `
			function ${add_css}() {
				var style = @element("style");
				style.id = "${component.stylesheet.id}-style";
				style.textContent = "${styles}";
				@append(@_document.head, style);
			}
		`);
    	    }
    	    // fix order
    	    // TODO the deconflicted names of blocks are reversed... should set them here
    	    const blocks = renderer.blocks.slice().reverse();
    	    body.push(...blocks.map(block => {
    	        // TODO this is a horrible mess — renderer.blocks
    	        // contains a mixture of Blocks and Nodes
    	        if (block.render)
    	            return block.render();
    	        return block;
    	    }));
    	    if (options.dev && !options.hydratable) {
    	        block.chunks.claim.push(b `throw new @_Error("options.hydrate only works if the component was compiled with the \`hydratable: true\` option");`);
    	    }
    	    const uses_props = component.var_lookup.has('$$props');
    	    const $$props = uses_props ? `$$new_props` : `$$props`;
    	    const props = component.vars.filter(variable => !variable.module && variable.export_name);
    	    const writable_props = props.filter(variable => variable.writable);
    	    const set = (uses_props || writable_props.length > 0 || component.slots.size > 0)
    	        ? x `
			${$$props} => {
				${uses_props && renderer.invalidate('$$props', x `$$props = @assign(@assign({}, $$props), @exclude_internal_props($$new_props))`)}
				${writable_props.map(prop => b `if ('${prop.export_name}' in ${$$props}) ${renderer.invalidate(prop.name, x `${prop.name} = ${$$props}.${prop.export_name}`)};`)}
				${component.slots.size > 0 &&
            b `if ('$$scope' in ${$$props}) ${renderer.invalidate('$$scope', x `$$scope = ${$$props}.$$scope`)};`}
			}
		`
    	        : null;
    	    const accessors = [];
    	    const not_equal = component.component_options.immutable ? x `@not_equal` : x `@safe_not_equal`;
    	    let dev_props_check;
    	    let inject_state;
    	    let capture_state;
    	    props.forEach(prop => {
    	        const variable = component.var_lookup.get(prop.name);
    	        if (!variable.writable || component.component_options.accessors) {
    	            accessors.push({
    	                type: 'MethodDefinition',
    	                kind: 'get',
    	                key: { type: 'Identifier', name: prop.export_name },
    	                value: x `function() {
					return ${prop.hoistable ? prop.name : x `this.$$.ctx[${renderer.context_lookup.get(prop.name).index}]`}
				}`
    	            });
    	        }
    	        else if (component.compile_options.dev) {
    	            accessors.push({
    	                type: 'MethodDefinition',
    	                kind: 'get',
    	                key: { type: 'Identifier', name: prop.export_name },
    	                value: x `function() {
					throw new @_Error("<${component.tag}>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
				}`
    	            });
    	        }
    	        if (component.component_options.accessors) {
    	            if (variable.writable && !renderer.readonly.has(prop.name)) {
    	                accessors.push({
    	                    type: 'MethodDefinition',
    	                    kind: 'set',
    	                    key: { type: 'Identifier', name: prop.export_name },
    	                    value: x `function(${prop.name}) {
						this.$set({ ${prop.export_name}: ${prop.name} });
						@flush();
					}`
    	                });
    	            }
    	            else if (component.compile_options.dev) {
    	                accessors.push({
    	                    type: 'MethodDefinition',
    	                    kind: 'set',
    	                    key: { type: 'Identifier', name: prop.export_name },
    	                    value: x `function(value) {
						throw new @_Error("<${component.tag}>: Cannot set read-only property '${prop.export_name}'");
					}`
    	                });
    	            }
    	        }
    	        else if (component.compile_options.dev) {
    	            accessors.push({
    	                type: 'MethodDefinition',
    	                kind: 'set',
    	                key: { type: 'Identifier', name: prop.export_name },
    	                value: x `function(value) {
					throw new @_Error("<${component.tag}>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
				}`
    	            });
    	        }
    	    });
    	    if (component.compile_options.dev) {
    	        // checking that expected ones were passed
    	        const expected = props.filter(prop => prop.writable && !prop.initialised);
    	        if (expected.length) {
    	            dev_props_check = b `
				const { ctx: #ctx } = this.$$;
				const props = ${options.customElement ? x `this.attributes` : x `options.props || {}`};
				${expected.map(prop => b `
				if (${renderer.reference(prop.name)} === undefined && !('${prop.export_name}' in props)) {
					@_console.warn("<${component.tag}> was created without expected prop '${prop.export_name}'");
				}`)}
			`;
    	        }
    	        capture_state = (uses_props || writable_props.length > 0) ? x `
			() => {
				return { ${component.vars.filter(prop => prop.writable).map(prop => p `${prop.name}`)} };
			}
		` : x `
			() => {
				return {};
			}
		`;
    	        const writable_vars = component.vars.filter(variable => !variable.module && variable.writable);
    	        inject_state = (uses_props || writable_vars.length > 0) ? x `
			${$$props} => {
				${uses_props && renderer.invalidate('$$props', x `$$props = @assign(@assign({}, $$props), $$new_props)`)}
				${writable_vars.map(prop => b `
					if ('${prop.name}' in $$props) ${renderer.invalidate(prop.name, x `${prop.name} = ${$$props}.${prop.name}`)};
				`)}
			}
		` : x `
			${$$props} => {}
		`;
    	    }
    	    // instrument assignments
    	    if (component.ast.instance) {
    	        let scope = component.instance_scope;
    	        const map = component.instance_scope_map;
    	        walk(component.ast.instance.content, {
    	            enter: (node) => {
    	                if (map.has(node)) {
    	                    scope = map.get(node);
    	                }
    	            },
    	            leave(node) {
    	                if (map.has(node)) {
    	                    scope = scope.parent;
    	                }
    	                if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
    	                    const assignee = node.type === 'AssignmentExpression' ? node.left : node.argument;
    	                    // normally (`a = 1`, `b.c = 2`), there'll be a single name
    	                    // (a or b). In destructuring cases (`[d, e] = [e, d]`) there
    	                    // may be more, in which case we need to tack the extra ones
    	                    // onto the initial function call
    	                    const names = new Set(extract_names(assignee));
    	                    this.replace(invalidate(renderer, scope, node, names));
    	                }
    	            }
    	        });
    	        component.rewrite_props(({ name, reassigned, export_name }) => {
    	            const value = `$${name}`;
    	            const i = renderer.context_lookup.get(`$${name}`).index;
    	            const insert = (reassigned || export_name)
    	                ? b `${`$$subscribe_${name}`}()`
    	                : b `@component_subscribe($$self, ${name}, #value => $$invalidate(${i}, ${value} = #value))`;
    	            if (component.compile_options.dev) {
    	                return b `@validate_store(${name}, '${name}'); ${insert}`;
    	            }
    	            return insert;
    	        });
    	    }
    	    const args = [x `$$self`];
    	    if (props.length > 0 || component.has_reactive_assignments || component.slots.size > 0) {
    	        args.push(x `$$props`, x `$$invalidate`);
    	    }
    	    const has_create_fragment = block.has_content();
    	    if (has_create_fragment) {
    	        body.push(b `
			function create_fragment(#ctx) {
				${block.get_contents()}
			}
		`);
    	    }
    	    body.push(b `
		${component.extract_javascript(component.ast.module)}

		${component.fully_hoisted}
	`);
    	    const filtered_props = props.filter(prop => {
    	        const variable = component.var_lookup.get(prop.name);
    	        if (variable.hoistable)
    	            return false;
    	        if (prop.name[0] === '$')
    	            return false;
    	        return true;
    	    });
    	    const reactive_stores = component.vars.filter(variable => variable.name[0] === '$' && variable.name[1] !== '$');
    	    const instance_javascript = component.extract_javascript(component.ast.instance);
    	    let i = renderer.context.length;
    	    while (i--) {
    	        const member = renderer.context[i];
    	        if (member.variable) {
    	            if (member.variable.referenced || member.variable.export_name)
    	                break;
    	        }
    	        else if (member.is_non_contextual) {
    	            break;
    	        }
    	    }
    	    const initial_context = renderer.context.slice(0, i + 1);
    	    const has_definition = ((instance_javascript && instance_javascript.length > 0) ||
    	        filtered_props.length > 0 ||
    	        uses_props ||
    	        component.partly_hoisted.length > 0 ||
    	        initial_context.length > 0 ||
    	        component.reactive_declarations.length > 0);
    	    const definition = has_definition
    	        ? component.alias('instance')
    	        : { type: 'Literal', value: null };
    	    const reactive_store_subscriptions = reactive_stores
    	        .filter(store => {
    	        const variable = component.var_lookup.get(store.name.slice(1));
    	        return !variable || variable.hoistable;
    	    })
    	        .map(({ name }) => b `
			${component.compile_options.dev && b `@validate_store(${name.slice(1)}, '${name.slice(1)}');`}
			@component_subscribe($$self, ${name.slice(1)}, $$value => $$invalidate(${renderer.context_lookup.get(name).index}, ${name} = $$value));
		`);
    	    const resubscribable_reactive_store_unsubscribers = reactive_stores
    	        .filter(store => {
    	        const variable = component.var_lookup.get(store.name.slice(1));
    	        return variable && (variable.reassigned || variable.export_name);
    	    })
    	        .map(({ name }) => b `$$self.$$.on_destroy.push(() => ${`$$unsubscribe_${name.slice(1)}`}());`);
    	    if (has_definition) {
    	        const reactive_declarations = [];
    	        const fixed_reactive_declarations = []; // not really 'reactive' but whatever
    	        component.reactive_declarations.forEach(d => {
    	            const dependencies = Array.from(d.dependencies);
    	            const uses_props = !!dependencies.find(n => n === '$$props');
    	            const writable = dependencies.filter(n => {
    	                const variable = component.var_lookup.get(n);
    	                return variable && (variable.export_name || variable.mutated || variable.reassigned);
    	            });
    	            const condition = !uses_props && writable.length > 0 && renderer.dirty(writable, true);
    	            let statement = d.node; // TODO remove label (use d.node.body) if it's not referenced
    	            if (condition)
    	                statement = b `if (${condition}) { ${statement} }`[0];
    	            if (condition || uses_props) {
    	                reactive_declarations.push(statement);
    	            }
    	            else {
    	                fixed_reactive_declarations.push(statement);
    	            }
    	        });
    	        const injected = Array.from(component.injected_reactive_declaration_vars).filter(name => {
    	            const variable = component.var_lookup.get(name);
    	            return variable.injected && variable.name[0] !== '$';
    	        });
    	        const reactive_store_declarations = reactive_stores.map(variable => {
    	            const $name = variable.name;
    	            const name = $name.slice(1);
    	            const store = component.var_lookup.get(name);
    	            if (store && (store.reassigned || store.export_name)) {
    	                const unsubscribe = `$$unsubscribe_${name}`;
    	                const subscribe = `$$subscribe_${name}`;
    	                const i = renderer.context_lookup.get($name).index;
    	                return b `let ${$name}, ${unsubscribe} = @noop, ${subscribe} = () => (${unsubscribe}(), ${unsubscribe} = @subscribe(${name}, $$value => $$invalidate(${i}, ${$name} = $$value)), ${name})`;
    	            }
    	            return b `let ${$name};`;
    	        });
    	        let unknown_props_check;
    	        if (component.compile_options.dev && !component.var_lookup.has('$$props') && writable_props.length) {
    	            unknown_props_check = b `
				const writable_props = [${writable_props.map(prop => x `'${prop.export_name}'`)}];
				@_Object.keys($$props).forEach(key => {
					if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$') @_console.warn(\`<${component.tag}> was created with unknown prop '\${key}'\`);
				});
			`;
    	        }
    	        const return_value = {
    	            type: 'ArrayExpression',
    	            elements: initial_context.map(member => ({
    	                type: 'Identifier',
    	                name: member.name
    	            }))
    	        };
    	        body.push(b `
			function ${definition}(${args}) {
				${reactive_store_declarations}

				${reactive_store_subscriptions}

				${resubscribable_reactive_store_unsubscribers}

				${instance_javascript}

				${unknown_props_check}

				${component.slots.size ? b `let { $$slots = {}, $$scope } = $$props;` : null}

				${renderer.binding_groups.length > 0 && b `const $$binding_groups = [${renderer.binding_groups.map(_ => x `[]`)}];`}

				${component.partly_hoisted}

				${set && b `$$self.$set = ${set};`}

				${capture_state && x `$$self.$capture_state = ${capture_state};`}

				${inject_state && x `$$self.$inject_state = ${inject_state};`}

				${injected.map(name => b `let ${name};`)}

				${reactive_declarations.length > 0 && b `
				$$self.$$.update = () => {
					${reactive_declarations}
				};
				`}

				${fixed_reactive_declarations}

				${uses_props && b `$$props = @exclude_internal_props($$props);`}

				return ${return_value};
			}
		`);
    	    }
    	    const prop_indexes = x `{
		${props.filter(v => v.export_name && !v.module).map(v => p `${v.export_name}: ${renderer.context_lookup.get(v.name).index}`)}
	}`;
    	    let dirty;
    	    if (renderer.context_overflow) {
    	        dirty = x `[]`;
    	        for (let i = 0; i < renderer.context.length; i += 31) {
    	            dirty.elements.push(x `-1`);
    	        }
    	    }
    	    if (options.customElement) {
    	        const declaration = b `
			class ${name} extends @SvelteElement {
				constructor(options) {
					super();

					${css.code && b `this.shadowRoot.innerHTML = \`<style>${css.code.replace(/\\/g, '\\\\')}${options.dev ? `\n/*# sourceMappingURL=${css.map.toUrl()} */` : ''}</style>\`;`}

					@init(this, { target: this.shadowRoot }, ${definition}, ${has_create_fragment ? 'create_fragment' : 'null'}, ${not_equal}, ${prop_indexes}, ${dirty});

					${dev_props_check}

					if (options) {
						if (options.target) {
							@insert(options.target, this, options.anchor);
						}

						${(props.length > 0 || uses_props) && b `
						if (options.props) {
							this.$set(options.props);
							@flush();
						}`}
					}
				}
			}
		`[0];
    	        if (props.length > 0) {
    	            declaration.body.body.push({
    	                type: 'MethodDefinition',
    	                kind: 'get',
    	                static: true,
    	                computed: false,
    	                key: { type: 'Identifier', name: 'observedAttributes' },
    	                value: x `function() {
					return [${props.map(prop => x `"${prop.export_name}"`)}];
				}`
    	            });
    	        }
    	        declaration.body.body.push(...accessors);
    	        body.push(declaration);
    	        if (component.tag != null) {
    	            body.push(b `
				@_customElements.define("${component.tag}", ${name});
			`);
    	        }
    	    }
    	    else {
    	        const superclass = {
    	            type: 'Identifier',
    	            name: options.dev ? '@SvelteComponentDev' : '@SvelteComponent'
    	        };
    	        const declaration = b `
			class ${name} extends ${superclass} {
				constructor(options) {
					super(${options.dev && `options`});
					${should_add_css && b `if (!@_document.getElementById("${component.stylesheet.id}-style")) ${add_css}();`}
					@init(this, options, ${definition}, ${has_create_fragment ? 'create_fragment' : 'null'}, ${not_equal}, ${prop_indexes}, ${dirty});
					${options.dev && b `@dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "${name.name}", options, id: create_fragment.name });`}

					${dev_props_check}
				}
			}
		`[0];
    	        declaration.body.body.push(...accessors);
    	        body.push(declaration);
    	    }
    	    return flatten$1(body, []);
    	}
    	function flatten$1(nodes, target) {
    	    for (let i = 0; i < nodes.length; i += 1) {
    	        const node = nodes[i];
    	        if (Array.isArray(node)) {
    	            flatten$1(node, target);
    	        }
    	        else {
    	            target.push(node);
    	        }
    	    }
    	    return target;
    	}

    	function AwaitBlock (node, renderer, options) {
    	    renderer.push();
    	    renderer.render(node.pending.children, options);
    	    const pending = renderer.pop();
    	    renderer.push();
    	    renderer.render(node.then.children, options);
    	    const then = renderer.pop();
    	    renderer.add_expression(x `
		(function(__value) {
			if (@is_promise(__value)) return ${pending};
			return (function(${node.value}) { return ${then}; }(__value));
		}(${node.expression.node}))
	`);
    	}

    	function Comment$1 (_node, _renderer, _options) {
    	    // TODO preserve comments
    	    // if (options.preserveComments) {
    	    // 	renderer.append(`<!--${node.data}-->`);
    	    // }
    	}

    	function DebugTag (node, renderer, options) {
    	    if (!options.dev)
    	        return;
    	    const filename = options.filename || null;
    	    const { line, column } = options.locate(node.start + 1);
    	    const obj = x `{
		${node.expressions.map(e => p `${e.node.name}`)}
	}`;
    	    renderer.add_expression(x `@debug(${filename ? x `"${filename}"` : x `null`}, ${line - 1}, ${column}, ${obj})`);
    	}

    	function EachBlock (node, renderer, options) {
    	    const args = [node.context_node];
    	    if (node.index)
    	        args.push({ type: 'Identifier', name: node.index });
    	    renderer.push();
    	    renderer.render(node.children, options);
    	    const result = renderer.pop();
    	    const consequent = x `@each(${node.expression.node}, (${args}) => ${result})`;
    	    if (node.else) {
    	        renderer.push();
    	        renderer.render(node.else.children, options);
    	        const alternate = renderer.pop();
    	        renderer.add_expression(x `${node.expression.node}.length ? ${consequent} : ${alternate}`);
    	    }
    	    else {
    	        renderer.add_expression(consequent);
    	    }
    	}

    	function get_class_attribute_value(attribute) {
    	    // handle special case — `class={possiblyUndefined}` with scoped CSS
    	    if (attribute.chunks.length === 2 && attribute.chunks[1].synthetic) {
    	        const value = attribute.chunks[0].node;
    	        return x `@escape(@null_to_empty(${value})) + "${attribute.chunks[1].data}"`;
    	    }
    	    return get_attribute_value(attribute);
    	}
    	function get_attribute_value(attribute) {
    	    if (attribute.chunks.length === 0)
    	        return x `""`;
    	    return attribute.chunks
    	        .map((chunk) => {
    	        return chunk.type === 'Text'
    	            ? string_literal(chunk.data.replace(/"/g, '&quot;'))
    	            : x `@escape(${chunk.node})`;
    	    })
    	        .reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	}

    	function get_slot_scope(lets) {
    	    if (lets.length === 0)
    	        return null;
    	    return {
    	        type: 'ObjectPattern',
    	        properties: lets.map(l => {
    	            return {
    	                type: 'Property',
    	                kind: 'init',
    	                method: false,
    	                shorthand: false,
    	                computed: false,
    	                key: l.name,
    	                value: l.value || l.name
    	            };
    	        })
    	    };
    	}

    	// source: https://html.spec.whatwg.org/multipage/indices.html
    	const boolean_attributes = new Set([
    	    'allowfullscreen',
    	    'allowpaymentrequest',
    	    'async',
    	    'autofocus',
    	    'autoplay',
    	    'checked',
    	    'controls',
    	    'default',
    	    'defer',
    	    'disabled',
    	    'formnovalidate',
    	    'hidden',
    	    'ismap',
    	    'loop',
    	    'multiple',
    	    'muted',
    	    'nomodule',
    	    'novalidate',
    	    'open',
    	    'playsinline',
    	    'readonly',
    	    'required',
    	    'reversed',
    	    'selected'
    	]);

    	function Element (node, renderer, options) {
    	    // awkward special case
    	    let node_contents;
    	    const contenteditable = (node.name !== 'textarea' &&
    	        node.name !== 'input' &&
    	        node.attributes.some((attribute) => attribute.name === 'contenteditable'));
    	    const slot = node.get_static_attribute_value('slot');
    	    const nearest_inline_component = node.find_nearest(/InlineComponent/);
    	    if (slot && nearest_inline_component) {
    	        renderer.push();
    	    }
    	    renderer.add_string(`<${node.name}`);
    	    const class_expression_list = node.classes.map(class_directive => {
    	        const { expression, name } = class_directive;
    	        const snippet = expression ? expression.node : x `#ctx.${name}`; // TODO is this right?
    	        return x `${snippet} ? "${name}" : ""`;
    	    });
    	    if (node.needs_manual_style_scoping) {
    	        class_expression_list.push(x `"${node.component.stylesheet.id}"`);
    	    }
    	    const class_expression = class_expression_list.length > 0 &&
    	        class_expression_list.reduce((lhs, rhs) => x `${lhs} + ' ' + ${rhs}`);
    	    if (node.attributes.some(attr => attr.is_spread)) {
    	        // TODO dry this out
    	        const args = [];
    	        node.attributes.forEach(attribute => {
    	            if (attribute.is_spread) {
    	                args.push(attribute.expression.node);
    	            }
    	            else {
    	                const name = attribute.name.toLowerCase();
    	                if (name === 'value' && node.name.toLowerCase() === 'textarea') {
    	                    node_contents = get_attribute_value(attribute);
    	                }
    	                else if (attribute.is_true) {
    	                    args.push(x `{ ${attribute.name}: true }`);
    	                }
    	                else if (boolean_attributes.has(name) &&
    	                    attribute.chunks.length === 1 &&
    	                    attribute.chunks[0].type !== 'Text') {
    	                    // a boolean attribute with one non-Text chunk
    	                    args.push(x `{ ${attribute.name}: ${attribute.chunks[0].node} || null }`);
    	                }
    	                else {
    	                    args.push(x `{ ${attribute.name}: ${get_attribute_value(attribute)} }`);
    	                }
    	            }
    	        });
    	        renderer.add_expression(x `@spread([${args}], ${class_expression});`);
    	    }
    	    else {
    	        let add_class_attribute = !!class_expression;
    	        node.attributes.forEach(attribute => {
    	            const name = attribute.name.toLowerCase();
    	            if (name === 'value' && node.name.toLowerCase() === 'textarea') {
    	                node_contents = get_attribute_value(attribute);
    	            }
    	            else if (attribute.is_true) {
    	                renderer.add_string(` ${attribute.name}`);
    	            }
    	            else if (boolean_attributes.has(name) &&
    	                attribute.chunks.length === 1 &&
    	                attribute.chunks[0].type !== 'Text') {
    	                // a boolean attribute with one non-Text chunk
    	                renderer.add_string(` `);
    	                renderer.add_expression(x `${attribute.chunks[0].node} ? "${attribute.name}" : ""`);
    	            }
    	            else if (name === 'class' && class_expression) {
    	                add_class_attribute = false;
    	                renderer.add_string(` ${attribute.name}="`);
    	                renderer.add_expression(x `[${get_class_attribute_value(attribute)}, ${class_expression}].join(' ').trim()`);
    	                renderer.add_string(`"`);
    	            }
    	            else if (attribute.chunks.length === 1 && attribute.chunks[0].type !== 'Text') {
    	                const snippet = attribute.chunks[0].node;
    	                renderer.add_expression(x `@add_attribute("${attribute.name}", ${snippet}, ${boolean_attributes.has(name) ? 1 : 0})`);
    	            }
    	            else {
    	                renderer.add_string(` ${attribute.name}="`);
    	                renderer.add_expression((name === 'class' ? get_class_attribute_value : get_attribute_value)(attribute));
    	                renderer.add_string(`"`);
    	            }
    	        });
    	        if (add_class_attribute) {
    	            renderer.add_expression(x `@add_classes([${class_expression}].join(' ').trim())`);
    	        }
    	    }
    	    node.bindings.forEach(binding => {
    	        const { name, expression } = binding;
    	        if (binding.is_readonly) {
    	            return;
    	        }
    	        if (name === 'group') ;
    	        else if (contenteditable && (name === 'textContent' || name === 'innerHTML')) {
    	            node_contents = expression.node;
    	            // TODO where was this used?
    	            // value = name === 'textContent' ? x`@escape($$value)` : x`$$value`;
    	        }
    	        else if (binding.name === 'value' && node.name === 'textarea') {
    	            const snippet = expression.node;
    	            node_contents = x `${snippet} || ""`;
    	        }
    	        else {
    	            const snippet = expression.node;
    	            renderer.add_expression(x `@add_attribute("${name}", ${snippet}, 1)`);
    	        }
    	    });
    	    renderer.add_string('>');
    	    if (node_contents !== undefined) {
    	        if (contenteditable) {
    	            renderer.push();
    	            renderer.render(node.children, options);
    	            const result = renderer.pop();
    	            renderer.add_expression(x `($$value => $$value === void 0 ? ${result} : $$value)(${node_contents})`);
    	        }
    	        else {
    	            renderer.add_expression(node_contents);
    	        }
    	        if (!is_void(node.name)) {
    	            renderer.add_string(`</${node.name}>`);
    	        }
    	    }
    	    else if (slot && nearest_inline_component) {
    	        renderer.render(node.children, options);
    	        if (!is_void(node.name)) {
    	            renderer.add_string(`</${node.name}>`);
    	        }
    	        const lets = node.lets;
    	        const seen = new Set(lets.map(l => l.name.name));
    	        nearest_inline_component.lets.forEach(l => {
    	            if (!seen.has(l.name.name))
    	                lets.push(l);
    	        });
    	        options.slot_scopes.set(slot, {
    	            input: get_slot_scope(node.lets),
    	            output: renderer.pop()
    	        });
    	    }
    	    else {
    	        renderer.render(node.children, options);
    	        if (!is_void(node.name)) {
    	            renderer.add_string(`</${node.name}>`);
    	        }
    	    }
    	}

    	function Head (node, renderer, options) {
    	    renderer.push();
    	    renderer.render(node.children, options);
    	    const result = renderer.pop();
    	    renderer.add_expression(x `($$result.head += ${result}, "")`);
    	}

    	function HtmlTag (node, renderer, _options) {
    	    renderer.add_expression(node.expression.node);
    	}

    	function IfBlock (node, renderer, options) {
    	    const condition = node.expression.node;
    	    renderer.push();
    	    renderer.render(node.children, options);
    	    const consequent = renderer.pop();
    	    renderer.push();
    	    if (node.else)
    	        renderer.render(node.else.children, options);
    	    const alternate = renderer.pop();
    	    renderer.add_expression(x `${condition} ? ${consequent} : ${alternate}`);
    	}

    	function get_prop_value(attribute) {
    	    if (attribute.is_true)
    	        return x `true`;
    	    if (attribute.chunks.length === 0)
    	        return x `''`;
    	    return attribute.chunks
    	        .map(chunk => {
    	        if (chunk.type === 'Text')
    	            return string_literal(chunk.data);
    	        return chunk.node;
    	    })
    	        .reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	}
    	function InlineComponent (node, renderer, options) {
    	    const binding_props = [];
    	    const binding_fns = [];
    	    node.bindings.forEach(binding => {
    	        renderer.has_bindings = true;
    	        // TODO this probably won't work for contextual bindings
    	        const snippet = binding.expression.node;
    	        binding_props.push(p `${binding.name}: ${snippet}`);
    	        binding_fns.push(p `${binding.name}: $$value => { ${snippet} = $$value; $$settled = false }`);
    	    });
    	    const uses_spread = node.attributes.find(attr => attr.is_spread);
    	    let props;
    	    if (uses_spread) {
    	        props = x `@_Object.assign(${node.attributes
            .map(attribute => {
            if (attribute.is_spread) {
                return attribute.expression.node;
            }
            else {
                return x `{ ${attribute.name}: ${get_prop_value(attribute)} }`;
            }
        })
            .concat(binding_props.map(p => x `{ ${p} }`))})`;
    	    }
    	    else {
    	        props = x `{
			${node.attributes.map(attribute => p `${attribute.name}: ${get_prop_value(attribute)}`)},
			${binding_props}
		}`;
    	    }
    	    const bindings = x `{
		${binding_fns}
	}`;
    	    const expression = (node.name === 'svelte:self'
    	        ? renderer.name
    	        : node.name === 'svelte:component'
    	            ? x `(${node.expression.node}) || @missing_component`
    	            : node.name.split('.').reduce(((lhs, rhs) => x `${lhs}.${rhs}`)));
    	    const slot_fns = [];
    	    if (node.children.length) {
    	        const slot_scopes = new Map();
    	        renderer.push();
    	        renderer.render(node.children, Object.assign({}, options, {
    	            slot_scopes
    	        }));
    	        slot_scopes.set('default', {
    	            input: get_slot_scope(node.lets),
    	            output: renderer.pop()
    	        });
    	        slot_scopes.forEach(({ input, output }, name) => {
    	            slot_fns.push(p `${name}: (${input}) => ${output}`);
    	        });
    	    }
    	    const slots = x `{
		${slot_fns}
	}`;
    	    renderer.add_expression(x `@validate_component(${expression}, "${node.name}").$$render($$result, ${props}, ${bindings}, ${slots})`);
    	}

    	function Slot (node, renderer, options) {
    	    const slot_data = get_slot_data(node.values);
    	    renderer.push();
    	    renderer.render(node.children, options);
    	    const result = renderer.pop();
    	    renderer.add_expression(x `
		$$slots.${node.slot_name}
			? $$slots.${node.slot_name}(${slot_data})
			: ${result}
	`);
    	}

    	function Tag$1 (node, renderer, _options) {
    	    const snippet = node.expression.node;
    	    renderer.add_expression(node.parent &&
    	        node.parent.type === 'Element' &&
    	        node.parent.name === 'style'
    	        ? snippet
    	        : x `@escape(${snippet})`);
    	}

    	function Text (node, renderer, _options) {
    	    let text = node.data;
    	    if (!node.parent ||
    	        node.parent.type !== 'Element' ||
    	        (node.parent.name !== 'script' && node.parent.name !== 'style')) {
    	        // unless this Text node is inside a <script> or <style> element, escape &,<,>
    	        text = escape_html(text);
    	    }
    	    renderer.add_string(text);
    	}

    	function Title (node, renderer, options) {
    	    renderer.add_string(`<title>`);
    	    renderer.render(node.children, options);
    	    renderer.add_string(`</title>`);
    	}

    	function noop$1() { }
    	const handlers$1 = {
    	    AwaitBlock,
    	    Body: noop$1,
    	    Comment: Comment$1,
    	    DebugTag,
    	    EachBlock,
    	    Element,
    	    Head,
    	    IfBlock,
    	    InlineComponent,
    	    MustacheTag: Tag$1,
    	    Options: noop$1,
    	    RawMustacheTag: HtmlTag,
    	    Slot,
    	    Text,
    	    Title,
    	    Window: noop$1
    	};
    	class Renderer$1 {
    	    constructor({ name }) {
    	        this.has_bindings = false;
    	        this.stack = [];
    	        this.targets = [];
    	        this.name = name;
    	        this.push();
    	    }
    	    add_string(str) {
    	        this.current.value += escape_template(str);
    	    }
    	    add_expression(node) {
    	        this.literal.quasis.push({
    	            type: 'TemplateElement',
    	            value: { raw: this.current.value, cooked: null },
    	            tail: false
    	        });
    	        this.literal.expressions.push(node);
    	        this.current.value = '';
    	    }
    	    push() {
    	        const current = this.current = { value: '' };
    	        const literal = this.literal = {
    	            type: 'TemplateLiteral',
    	            expressions: [],
    	            quasis: []
    	        };
    	        this.stack.push({ current, literal });
    	    }
    	    pop() {
    	        this.literal.quasis.push({
    	            type: 'TemplateElement',
    	            value: { raw: this.current.value, cooked: null },
    	            tail: true
    	        });
    	        const popped = this.stack.pop();
    	        const last = this.stack[this.stack.length - 1];
    	        if (last) {
    	            this.literal = last.literal;
    	            this.current = last.current;
    	        }
    	        return popped.literal;
    	    }
    	    render(nodes, options) {
    	        nodes.forEach(node => {
    	            const handler = handlers$1[node.type];
    	            if (!handler) {
    	                throw new Error(`No handler for '${node.type}' nodes`);
    	            }
    	            handler(node, this, options);
    	        });
    	    }
    	}

    	function ssr(component, options) {
    	    const renderer = new Renderer$1({
    	        name: component.name
    	    });
    	    const { name } = component;
    	    // create $$render function
    	    renderer.render(trim(component.fragment.children), Object.assign({
    	        locate: component.locate
    	    }, options));
    	    // TODO put this inside the Renderer class
    	    const literal = renderer.pop();
    	    // TODO concatenate CSS maps
    	    const css = options.customElement ?
    	        { code: null, map: null } :
    	        component.stylesheet.render(options.filename, true);
    	    const reactive_stores = component.vars.filter(variable => variable.name[0] === '$' && variable.name[1] !== '$');
    	    const reactive_store_values = reactive_stores
    	        .map(({ name }) => {
    	        const store_name = name.slice(1);
    	        const store = component.var_lookup.get(store_name);
    	        if (store && store.hoistable)
    	            return null;
    	        const assignment = b `${name} = @get_store_value(${store_name});`;
    	        return component.compile_options.dev
    	            ? b `@validate_store(${store_name}, '${store_name}'); ${assignment}`
    	            : assignment;
    	    })
    	        .filter(Boolean);
    	    component.rewrite_props(({ name }) => {
    	        const value = `$${name}`;
    	        let insert = b `${value} = @get_store_value(${name})`;
    	        if (component.compile_options.dev) {
    	            insert = b `@validate_store(${name}, '${name}'); ${insert}`;
    	        }
    	        return insert;
    	    });
    	    const instance_javascript = component.extract_javascript(component.ast.instance);
    	    // TODO only do this for props with a default value
    	    const parent_bindings = instance_javascript
    	        ? component.vars
    	            .filter(variable => !variable.module && variable.export_name)
    	            .map(prop => {
    	            return b `if ($$props.${prop.export_name} === void 0 && $$bindings.${prop.export_name} && ${prop.name} !== void 0) $$bindings.${prop.export_name}(${prop.name});`;
    	        })
    	        : [];
    	    const reactive_declarations = component.reactive_declarations.map(d => {
    	        const body = d.node.body;
    	        let statement = b `${body}`;
    	        if (d.declaration) {
    	            const declared = extract_names(d.declaration);
    	            const injected = declared.filter(name => {
    	                return name[0] !== '$' && component.var_lookup.get(name).injected;
    	            });
    	            const self_dependencies = injected.filter(name => d.dependencies.has(name));
    	            if (injected.length) {
    	                // in some cases we need to do `let foo; [expression]`, in
    	                // others we can do `let [expression]`
    	                const separate = (self_dependencies.length > 0 ||
    	                    declared.length > injected.length);
    	                const { left, right } = body.expression;
    	                statement = separate
    	                    ? b `
						${injected.map(name => b `let ${name};`)}
						${statement}`
    	                    : b `
						let ${left} = ${right}`;
    	            }
    	        }
    	        else { // TODO do not add label if it's not referenced
    	            statement = b `$: { ${statement} }`;
    	        }
    	        return statement;
    	    });
    	    const main = renderer.has_bindings
    	        ? b `
			let $$settled;
			let $$rendered;

			do {
				$$settled = true;

				${reactive_store_values}

				${reactive_declarations}

				$$rendered = ${literal};
			} while (!$$settled);

			return $$rendered;
		`
    	        : b `
			${reactive_store_values}

			${reactive_declarations}

			return ${literal};`;
    	    const blocks = [
    	        ...reactive_stores.map(({ name }) => {
    	            const store_name = name.slice(1);
    	            const store = component.var_lookup.get(store_name);
    	            if (store && store.hoistable) {
    	                return b `let ${name} = @get_store_value(${store_name});`;
    	            }
    	            return b `let ${name};`;
    	        }),
    	        instance_javascript,
    	        ...parent_bindings,
    	        css.code && b `$$result.css.add(#css);`,
    	        main
    	    ].filter(Boolean);
    	    return b `
		${css.code ? b `
		const #css = {
			code: "${css.code}",
			map: ${css.map ? string_literal(css.map.toString()) : 'null'}
		};` : null}

		${component.extract_javascript(component.ast.module)}

		${component.fully_hoisted}

		const ${name} = @create_ssr_component(($$result, $$props, $$bindings, $$slots) => {
			${blocks}
		});
	`;
    	}
    	function trim(nodes) {
    	    let start = 0;
    	    for (; start < nodes.length; start += 1) {
    	        const node = nodes[start];
    	        if (node.type !== 'Text')
    	            break;
    	        node.data = node.data.replace(/^\s+/, '');
    	        if (node.data)
    	            break;
    	    }
    	    let end = nodes.length;
    	    for (; end > start; end -= 1) {
    	        const node = nodes[end - 1];
    	        if (node.type !== 'Text')
    	            break;
    	        node.data = node.data.replace(/\s+$/, '');
    	        if (node.data)
    	            break;
    	    }
    	    return nodes.slice(start, end);
    	}

    	const wrappers$1 = { esm, cjs };
    	function create_module(program, format, name, banner, sveltePath = 'svelte', helpers, globals, imports, module_exports) {
    	    const internal_path = `${sveltePath}/internal`;
    	    helpers.sort((a, b) => (a.name < b.name) ? -1 : 1);
    	    globals.sort((a, b) => (a.name < b.name) ? -1 : 1);
    	    if (format === 'esm') {
    	        return esm(program, name, banner, sveltePath, internal_path, helpers, globals, imports, module_exports);
    	    }
    	    if (format === 'cjs')
    	        return cjs(program, name, banner, sveltePath, internal_path, helpers, globals, imports, module_exports);
    	    throw new Error(`options.format is invalid (must be ${list$1(Object.keys(wrappers$1))})`);
    	}
    	function edit_source(source, sveltePath) {
    	    return source === 'svelte' || source.startsWith('svelte/')
    	        ? source.replace('svelte', sveltePath)
    	        : source;
    	}
    	function get_internal_globals(globals, helpers) {
    	    return globals.length > 0 && {
    	        type: 'VariableDeclaration',
    	        kind: 'const',
    	        declarations: [{
    	                type: 'VariableDeclarator',
    	                id: {
    	                    type: 'ObjectPattern',
    	                    properties: globals.map(g => ({
    	                        type: 'Property',
    	                        method: false,
    	                        shorthand: false,
    	                        computed: false,
    	                        key: { type: 'Identifier', name: g.name },
    	                        value: g.alias,
    	                        kind: 'init'
    	                    }))
    	                },
    	                init: helpers.find(({ name }) => name === 'globals').alias
    	            }]
    	    };
    	}
    	function esm(program, name, banner, sveltePath, internal_path, helpers, globals, imports, module_exports) {
    	    const import_declaration = {
    	        type: 'ImportDeclaration',
    	        specifiers: helpers.map(h => ({
    	            type: 'ImportSpecifier',
    	            local: h.alias,
    	            imported: { type: 'Identifier', name: h.name }
    	        })),
    	        source: { type: 'Literal', value: internal_path }
    	    };
    	    const internal_globals = get_internal_globals(globals, helpers);
    	    // edit user imports
    	    imports.forEach(node => {
    	        node.source.value = edit_source(node.source.value, sveltePath);
    	    });
    	    const exports = module_exports.length > 0 && {
    	        type: 'ExportNamedDeclaration',
    	        specifiers: module_exports.map(x => ({
    	            type: 'Specifier',
    	            local: { type: 'Identifier', name: x.name },
    	            exported: { type: 'Identifier', name: x.as }
    	        }))
    	    };
    	    program.body = b `
		/* ${banner} */

		${import_declaration}
		${internal_globals}
		${imports}

		${program.body}

		export default ${name};
		${exports}
	`;
    	}
    	function cjs(program, name, banner, sveltePath, internal_path, helpers, globals, imports, module_exports) {
    	    const internal_requires = {
    	        type: 'VariableDeclaration',
    	        kind: 'const',
    	        declarations: [{
    	                type: 'VariableDeclarator',
    	                id: {
    	                    type: 'ObjectPattern',
    	                    properties: helpers.map(h => ({
    	                        type: 'Property',
    	                        method: false,
    	                        shorthand: false,
    	                        computed: false,
    	                        key: { type: 'Identifier', name: h.name },
    	                        value: h.alias,
    	                        kind: 'init'
    	                    }))
    	                },
    	                init: x `require("${internal_path}")`
    	            }]
    	    };
    	    const internal_globals = get_internal_globals(globals, helpers);
    	    const user_requires = imports.map(node => ({
    	        type: 'VariableDeclaration',
    	        kind: 'const',
    	        declarations: [{
    	                type: 'VariableDeclarator',
    	                id: node.specifiers[0].type === 'ImportNamespaceSpecifier'
    	                    ? { type: 'Identifier', name: node.specifiers[0].local.name }
    	                    : {
    	                        type: 'ObjectPattern',
    	                        properties: node.specifiers.map(s => ({
    	                            type: 'Property',
    	                            method: false,
    	                            shorthand: false,
    	                            computed: false,
    	                            key: s.type === 'ImportSpecifier' ? s.imported : { type: 'Identifier', name: 'default' },
    	                            value: s.local,
    	                            kind: 'init'
    	                        }))
    	                    },
    	                init: x `require("${edit_source(node.source.value, sveltePath)}")`
    	            }]
    	    }));
    	    const exports = module_exports.map(x => b `exports.${{ type: 'Identifier', name: x.as }} = ${{ type: 'Identifier', name: x.name }};`);
    	    program.body = b `
		/* ${banner} */

		"use strict";
		${internal_requires}
		${internal_globals}
		${user_requires}

		${program.body}

		exports.default = ${name};
		${exports}
	`;
    	}

    	var Chunk = function Chunk(start, end, content) {
    		this.start = start;
    		this.end = end;
    		this.original = content;

    		this.intro = '';
    		this.outro = '';

    		this.content = content;
    		this.storeName = false;
    		this.edited = false;

    		// we make these non-enumerable, for sanity while debugging
    		Object.defineProperties(this, {
    			previous: { writable: true, value: null },
    			next:     { writable: true, value: null }
    		});
    	};

    	Chunk.prototype.appendLeft = function appendLeft (content) {
    		this.outro += content;
    	};

    	Chunk.prototype.appendRight = function appendRight (content) {
    		this.intro = this.intro + content;
    	};

    	Chunk.prototype.clone = function clone () {
    		var chunk = new Chunk(this.start, this.end, this.original);

    		chunk.intro = this.intro;
    		chunk.outro = this.outro;
    		chunk.content = this.content;
    		chunk.storeName = this.storeName;
    		chunk.edited = this.edited;

    		return chunk;
    	};

    	Chunk.prototype.contains = function contains (index) {
    		return this.start < index && index < this.end;
    	};

    	Chunk.prototype.eachNext = function eachNext (fn) {
    		var chunk = this;
    		while (chunk) {
    			fn(chunk);
    			chunk = chunk.next;
    		}
    	};

    	Chunk.prototype.eachPrevious = function eachPrevious (fn) {
    		var chunk = this;
    		while (chunk) {
    			fn(chunk);
    			chunk = chunk.previous;
    		}
    	};

    	Chunk.prototype.edit = function edit (content, storeName, contentOnly) {
    		this.content = content;
    		if (!contentOnly) {
    			this.intro = '';
    			this.outro = '';
    		}
    		this.storeName = storeName;

    		this.edited = true;

    		return this;
    	};

    	Chunk.prototype.prependLeft = function prependLeft (content) {
    		this.outro = content + this.outro;
    	};

    	Chunk.prototype.prependRight = function prependRight (content) {
    		this.intro = content + this.intro;
    	};

    	Chunk.prototype.split = function split (index) {
    		var sliceIndex = index - this.start;

    		var originalBefore = this.original.slice(0, sliceIndex);
    		var originalAfter = this.original.slice(sliceIndex);

    		this.original = originalBefore;

    		var newChunk = new Chunk(index, this.end, originalAfter);
    		newChunk.outro = this.outro;
    		this.outro = '';

    		this.end = index;

    		if (this.edited) {
    			// TODO is this block necessary?...
    			newChunk.edit('', false);
    			this.content = '';
    		} else {
    			this.content = originalBefore;
    		}

    		newChunk.next = this.next;
    		if (newChunk.next) { newChunk.next.previous = newChunk; }
    		newChunk.previous = this;
    		this.next = newChunk;

    		return newChunk;
    	};

    	Chunk.prototype.toString = function toString () {
    		return this.intro + this.content + this.outro;
    	};

    	Chunk.prototype.trimEnd = function trimEnd (rx) {
    		this.outro = this.outro.replace(rx, '');
    		if (this.outro.length) { return true; }

    		var trimmed = this.content.replace(rx, '');

    		if (trimmed.length) {
    			if (trimmed !== this.content) {
    				this.split(this.start + trimmed.length).edit('', undefined, true);
    			}
    			return true;

    		} else {
    			this.edit('', undefined, true);

    			this.intro = this.intro.replace(rx, '');
    			if (this.intro.length) { return true; }
    		}
    	};

    	Chunk.prototype.trimStart = function trimStart (rx) {
    		this.intro = this.intro.replace(rx, '');
    		if (this.intro.length) { return true; }

    		var trimmed = this.content.replace(rx, '');

    		if (trimmed.length) {
    			if (trimmed !== this.content) {
    				this.split(this.end - trimmed.length);
    				this.edit('', undefined, true);
    			}
    			return true;

    		} else {
    			this.edit('', undefined, true);

    			this.outro = this.outro.replace(rx, '');
    			if (this.outro.length) { return true; }
    		}
    	};

    	var btoa = function () {
    		throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.');
    	};
    	if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    		btoa = function (str) { return window.btoa(unescape(encodeURIComponent(str))); };
    	} else if (typeof Buffer === 'function') {
    		btoa = function (str) { return Buffer.from(str, 'utf-8').toString('base64'); };
    	}

    	var SourceMap = function SourceMap(properties) {
    		this.version = 3;
    		this.file = properties.file;
    		this.sources = properties.sources;
    		this.sourcesContent = properties.sourcesContent;
    		this.names = properties.names;
    		this.mappings = encode(properties.mappings);
    	};

    	SourceMap.prototype.toString = function toString () {
    		return JSON.stringify(this);
    	};

    	SourceMap.prototype.toUrl = function toUrl () {
    		return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
    	};

    	function guessIndent(code) {
    		var lines = code.split('\n');

    		var tabbed = lines.filter(function (line) { return /^\t+/.test(line); });
    		var spaced = lines.filter(function (line) { return /^ {2,}/.test(line); });

    		if (tabbed.length === 0 && spaced.length === 0) {
    			return null;
    		}

    		// More lines tabbed than spaced? Assume tabs, and
    		// default to tabs in the case of a tie (or nothing
    		// to go on)
    		if (tabbed.length >= spaced.length) {
    			return '\t';
    		}

    		// Otherwise, we need to guess the multiple
    		var min = spaced.reduce(function (previous, current) {
    			var numSpaces = /^ +/.exec(current)[0].length;
    			return Math.min(numSpaces, previous);
    		}, Infinity);

    		return new Array(min + 1).join(' ');
    	}

    	function getRelativePath(from, to) {
    		var fromParts = from.split(/[/\\]/);
    		var toParts = to.split(/[/\\]/);

    		fromParts.pop(); // get dirname

    		while (fromParts[0] === toParts[0]) {
    			fromParts.shift();
    			toParts.shift();
    		}

    		if (fromParts.length) {
    			var i = fromParts.length;
    			while (i--) { fromParts[i] = '..'; }
    		}

    		return fromParts.concat(toParts).join('/');
    	}

    	var toString$1 = Object.prototype.toString;

    	function isObject(thing) {
    		return toString$1.call(thing) === '[object Object]';
    	}

    	function getLocator$1(source) {
    		var originalLines = source.split('\n');
    		var lineOffsets = [];

    		for (var i = 0, pos = 0; i < originalLines.length; i++) {
    			lineOffsets.push(pos);
    			pos += originalLines[i].length + 1;
    		}

    		return function locate(index) {
    			var i = 0;
    			var j = lineOffsets.length;
    			while (i < j) {
    				var m = (i + j) >> 1;
    				if (index < lineOffsets[m]) {
    					j = m;
    				} else {
    					i = m + 1;
    				}
    			}
    			var line = i - 1;
    			var column = index - lineOffsets[line];
    			return { line: line, column: column };
    		};
    	}

    	var Mappings = function Mappings(hires) {
    		this.hires = hires;
    		this.generatedCodeLine = 0;
    		this.generatedCodeColumn = 0;
    		this.raw = [];
    		this.rawSegments = this.raw[this.generatedCodeLine] = [];
    		this.pending = null;
    	};

    	Mappings.prototype.addEdit = function addEdit (sourceIndex, content, loc, nameIndex) {
    		if (content.length) {
    			var segment = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
    			if (nameIndex >= 0) {
    				segment.push(nameIndex);
    			}
    			this.rawSegments.push(segment);
    		} else if (this.pending) {
    			this.rawSegments.push(this.pending);
    		}

    		this.advance(content);
    		this.pending = null;
    	};

    	Mappings.prototype.addUneditedChunk = function addUneditedChunk (sourceIndex, chunk, original, loc, sourcemapLocations) {
    		var originalCharIndex = chunk.start;
    		var first = true;

    		while (originalCharIndex < chunk.end) {
    			if (this.hires || first || sourcemapLocations[originalCharIndex]) {
    				this.rawSegments.push([this.generatedCodeColumn, sourceIndex, loc.line, loc.column]);
    			}

    			if (original[originalCharIndex] === '\n') {
    				loc.line += 1;
    				loc.column = 0;
    				this.generatedCodeLine += 1;
    				this.raw[this.generatedCodeLine] = this.rawSegments = [];
    				this.generatedCodeColumn = 0;
    			} else {
    				loc.column += 1;
    				this.generatedCodeColumn += 1;
    			}

    			originalCharIndex += 1;
    			first = false;
    		}

    		this.pending = [this.generatedCodeColumn, sourceIndex, loc.line, loc.column];
    	};

    	Mappings.prototype.advance = function advance (str) {
    		if (!str) { return; }

    		var lines = str.split('\n');

    		if (lines.length > 1) {
    			for (var i = 0; i < lines.length - 1; i++) {
    				this.generatedCodeLine++;
    				this.raw[this.generatedCodeLine] = this.rawSegments = [];
    			}
    			this.generatedCodeColumn = 0;
    		}

    		this.generatedCodeColumn += lines[lines.length - 1].length;
    	};

    	var n = '\n';

    	var warned = {
    		insertLeft: false,
    		insertRight: false,
    		storeName: false
    	};

    	var MagicString = function MagicString(string, options) {
    		if ( options === void 0 ) options = {};

    		var chunk = new Chunk(0, string.length, string);

    		Object.defineProperties(this, {
    			original:              { writable: true, value: string },
    			outro:                 { writable: true, value: '' },
    			intro:                 { writable: true, value: '' },
    			firstChunk:            { writable: true, value: chunk },
    			lastChunk:             { writable: true, value: chunk },
    			lastSearchedChunk:     { writable: true, value: chunk },
    			byStart:               { writable: true, value: {} },
    			byEnd:                 { writable: true, value: {} },
    			filename:              { writable: true, value: options.filename },
    			indentExclusionRanges: { writable: true, value: options.indentExclusionRanges },
    			sourcemapLocations:    { writable: true, value: {} },
    			storedNames:           { writable: true, value: {} },
    			indentStr:             { writable: true, value: guessIndent(string) }
    		});

    		this.byStart[0] = chunk;
    		this.byEnd[string.length] = chunk;
    	};

    	MagicString.prototype.addSourcemapLocation = function addSourcemapLocation (char) {
    		this.sourcemapLocations[char] = true;
    	};

    	MagicString.prototype.append = function append (content) {
    		if (typeof content !== 'string') { throw new TypeError('outro content must be a string'); }

    		this.outro += content;
    		return this;
    	};

    	MagicString.prototype.appendLeft = function appendLeft (index, content) {
    		if (typeof content !== 'string') { throw new TypeError('inserted content must be a string'); }

    		this._split(index);

    		var chunk = this.byEnd[index];

    		if (chunk) {
    			chunk.appendLeft(content);
    		} else {
    			this.intro += content;
    		}
    		return this;
    	};

    	MagicString.prototype.appendRight = function appendRight (index, content) {
    		if (typeof content !== 'string') { throw new TypeError('inserted content must be a string'); }

    		this._split(index);

    		var chunk = this.byStart[index];

    		if (chunk) {
    			chunk.appendRight(content);
    		} else {
    			this.outro += content;
    		}
    		return this;
    	};

    	MagicString.prototype.clone = function clone () {
    		var cloned = new MagicString(this.original, { filename: this.filename });

    		var originalChunk = this.firstChunk;
    		var clonedChunk = (cloned.firstChunk = cloned.lastSearchedChunk = originalChunk.clone());

    		while (originalChunk) {
    			cloned.byStart[clonedChunk.start] = clonedChunk;
    			cloned.byEnd[clonedChunk.end] = clonedChunk;

    			var nextOriginalChunk = originalChunk.next;
    			var nextClonedChunk = nextOriginalChunk && nextOriginalChunk.clone();

    			if (nextClonedChunk) {
    				clonedChunk.next = nextClonedChunk;
    				nextClonedChunk.previous = clonedChunk;

    				clonedChunk = nextClonedChunk;
    			}

    			originalChunk = nextOriginalChunk;
    		}

    		cloned.lastChunk = clonedChunk;

    		if (this.indentExclusionRanges) {
    			cloned.indentExclusionRanges = this.indentExclusionRanges.slice();
    		}

    		Object.keys(this.sourcemapLocations).forEach(function (loc) {
    			cloned.sourcemapLocations[loc] = true;
    		});

    		return cloned;
    	};

    	MagicString.prototype.generateDecodedMap = function generateDecodedMap (options) {
    			var this$1 = this;

    		options = options || {};

    		var sourceIndex = 0;
    		var names = Object.keys(this.storedNames);
    		var mappings = new Mappings(options.hires);

    		var locate = getLocator$1(this.original);

    		if (this.intro) {
    			mappings.advance(this.intro);
    		}

    		this.firstChunk.eachNext(function (chunk) {
    			var loc = locate(chunk.start);

    			if (chunk.intro.length) { mappings.advance(chunk.intro); }

    			if (chunk.edited) {
    				mappings.addEdit(
    					sourceIndex,
    					chunk.content,
    					loc,
    					chunk.storeName ? names.indexOf(chunk.original) : -1
    				);
    			} else {
    				mappings.addUneditedChunk(sourceIndex, chunk, this$1.original, loc, this$1.sourcemapLocations);
    			}

    			if (chunk.outro.length) { mappings.advance(chunk.outro); }
    		});

    		return {
    			file: options.file ? options.file.split(/[/\\]/).pop() : null,
    			sources: [options.source ? getRelativePath(options.file || '', options.source) : null],
    			sourcesContent: options.includeContent ? [this.original] : [null],
    			names: names,
    			mappings: mappings.raw
    		};
    	};

    	MagicString.prototype.generateMap = function generateMap (options) {
    		return new SourceMap(this.generateDecodedMap(options));
    	};

    	MagicString.prototype.getIndentString = function getIndentString () {
    		return this.indentStr === null ? '\t' : this.indentStr;
    	};

    	MagicString.prototype.indent = function indent (indentStr, options) {
    		var pattern = /^[^\r\n]/gm;

    		if (isObject(indentStr)) {
    			options = indentStr;
    			indentStr = undefined;
    		}

    		indentStr = indentStr !== undefined ? indentStr : this.indentStr || '\t';

    		if (indentStr === '') { return this; } // noop

    		options = options || {};

    		// Process exclusion ranges
    		var isExcluded = {};

    		if (options.exclude) {
    			var exclusions =
    				typeof options.exclude[0] === 'number' ? [options.exclude] : options.exclude;
    			exclusions.forEach(function (exclusion) {
    				for (var i = exclusion[0]; i < exclusion[1]; i += 1) {
    					isExcluded[i] = true;
    				}
    			});
    		}

    		var shouldIndentNextCharacter = options.indentStart !== false;
    		var replacer = function (match) {
    			if (shouldIndentNextCharacter) { return ("" + indentStr + match); }
    			shouldIndentNextCharacter = true;
    			return match;
    		};

    		this.intro = this.intro.replace(pattern, replacer);

    		var charIndex = 0;
    		var chunk = this.firstChunk;

    		while (chunk) {
    			var end = chunk.end;

    			if (chunk.edited) {
    				if (!isExcluded[charIndex]) {
    					chunk.content = chunk.content.replace(pattern, replacer);

    					if (chunk.content.length) {
    						shouldIndentNextCharacter = chunk.content[chunk.content.length - 1] === '\n';
    					}
    				}
    			} else {
    				charIndex = chunk.start;

    				while (charIndex < end) {
    					if (!isExcluded[charIndex]) {
    						var char = this.original[charIndex];

    						if (char === '\n') {
    							shouldIndentNextCharacter = true;
    						} else if (char !== '\r' && shouldIndentNextCharacter) {
    							shouldIndentNextCharacter = false;

    							if (charIndex === chunk.start) {
    								chunk.prependRight(indentStr);
    							} else {
    								this._splitChunk(chunk, charIndex);
    								chunk = chunk.next;
    								chunk.prependRight(indentStr);
    							}
    						}
    					}

    					charIndex += 1;
    				}
    			}

    			charIndex = chunk.end;
    			chunk = chunk.next;
    		}

    		this.outro = this.outro.replace(pattern, replacer);

    		return this;
    	};

    	MagicString.prototype.insert = function insert () {
    		throw new Error('magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)');
    	};

    	MagicString.prototype.insertLeft = function insertLeft (index, content) {
    		if (!warned.insertLeft) {
    			console.warn('magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead'); // eslint-disable-line no-console
    			warned.insertLeft = true;
    		}

    		return this.appendLeft(index, content);
    	};

    	MagicString.prototype.insertRight = function insertRight (index, content) {
    		if (!warned.insertRight) {
    			console.warn('magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead'); // eslint-disable-line no-console
    			warned.insertRight = true;
    		}

    		return this.prependRight(index, content);
    	};

    	MagicString.prototype.move = function move (start, end, index) {
    		if (index >= start && index <= end) { throw new Error('Cannot move a selection inside itself'); }

    		this._split(start);
    		this._split(end);
    		this._split(index);

    		var first = this.byStart[start];
    		var last = this.byEnd[end];

    		var oldLeft = first.previous;
    		var oldRight = last.next;

    		var newRight = this.byStart[index];
    		if (!newRight && last === this.lastChunk) { return this; }
    		var newLeft = newRight ? newRight.previous : this.lastChunk;

    		if (oldLeft) { oldLeft.next = oldRight; }
    		if (oldRight) { oldRight.previous = oldLeft; }

    		if (newLeft) { newLeft.next = first; }
    		if (newRight) { newRight.previous = last; }

    		if (!first.previous) { this.firstChunk = last.next; }
    		if (!last.next) {
    			this.lastChunk = first.previous;
    			this.lastChunk.next = null;
    		}

    		first.previous = newLeft;
    		last.next = newRight || null;

    		if (!newLeft) { this.firstChunk = first; }
    		if (!newRight) { this.lastChunk = last; }
    		return this;
    	};

    	MagicString.prototype.overwrite = function overwrite (start, end, content, options) {
    		if (typeof content !== 'string') { throw new TypeError('replacement content must be a string'); }

    		while (start < 0) { start += this.original.length; }
    		while (end < 0) { end += this.original.length; }

    		if (end > this.original.length) { throw new Error('end is out of bounds'); }
    		if (start === end)
    			{ throw new Error('Cannot overwrite a zero-length range – use appendLeft or prependRight instead'); }

    		this._split(start);
    		this._split(end);

    		if (options === true) {
    			if (!warned.storeName) {
    				console.warn('The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string'); // eslint-disable-line no-console
    				warned.storeName = true;
    			}

    			options = { storeName: true };
    		}
    		var storeName = options !== undefined ? options.storeName : false;
    		var contentOnly = options !== undefined ? options.contentOnly : false;

    		if (storeName) {
    			var original = this.original.slice(start, end);
    			this.storedNames[original] = true;
    		}

    		var first = this.byStart[start];
    		var last = this.byEnd[end];

    		if (first) {
    			if (end > first.end && first.next !== this.byStart[first.end]) {
    				throw new Error('Cannot overwrite across a split point');
    			}

    			first.edit(content, storeName, contentOnly);

    			if (first !== last) {
    				var chunk = first.next;
    				while (chunk !== last) {
    					chunk.edit('', false);
    					chunk = chunk.next;
    				}

    				chunk.edit('', false);
    			}
    		} else {
    			// must be inserting at the end
    			var newChunk = new Chunk(start, end, '').edit(content, storeName);

    			// TODO last chunk in the array may not be the last chunk, if it's moved...
    			last.next = newChunk;
    			newChunk.previous = last;
    		}
    		return this;
    	};

    	MagicString.prototype.prepend = function prepend (content) {
    		if (typeof content !== 'string') { throw new TypeError('outro content must be a string'); }

    		this.intro = content + this.intro;
    		return this;
    	};

    	MagicString.prototype.prependLeft = function prependLeft (index, content) {
    		if (typeof content !== 'string') { throw new TypeError('inserted content must be a string'); }

    		this._split(index);

    		var chunk = this.byEnd[index];

    		if (chunk) {
    			chunk.prependLeft(content);
    		} else {
    			this.intro = content + this.intro;
    		}
    		return this;
    	};

    	MagicString.prototype.prependRight = function prependRight (index, content) {
    		if (typeof content !== 'string') { throw new TypeError('inserted content must be a string'); }

    		this._split(index);

    		var chunk = this.byStart[index];

    		if (chunk) {
    			chunk.prependRight(content);
    		} else {
    			this.outro = content + this.outro;
    		}
    		return this;
    	};

    	MagicString.prototype.remove = function remove (start, end) {
    		while (start < 0) { start += this.original.length; }
    		while (end < 0) { end += this.original.length; }

    		if (start === end) { return this; }

    		if (start < 0 || end > this.original.length) { throw new Error('Character is out of bounds'); }
    		if (start > end) { throw new Error('end must be greater than start'); }

    		this._split(start);
    		this._split(end);

    		var chunk = this.byStart[start];

    		while (chunk) {
    			chunk.intro = '';
    			chunk.outro = '';
    			chunk.edit('');

    			chunk = end > chunk.end ? this.byStart[chunk.end] : null;
    		}
    		return this;
    	};

    	MagicString.prototype.lastChar = function lastChar () {
    		if (this.outro.length)
    			{ return this.outro[this.outro.length - 1]; }
    		var chunk = this.lastChunk;
    		do {
    			if (chunk.outro.length)
    				{ return chunk.outro[chunk.outro.length - 1]; }
    			if (chunk.content.length)
    				{ return chunk.content[chunk.content.length - 1]; }
    			if (chunk.intro.length)
    				{ return chunk.intro[chunk.intro.length - 1]; }
    		} while (chunk = chunk.previous);
    		if (this.intro.length)
    			{ return this.intro[this.intro.length - 1]; }
    		return '';
    	};

    	MagicString.prototype.lastLine = function lastLine () {
    		var lineIndex = this.outro.lastIndexOf(n);
    		if (lineIndex !== -1)
    			{ return this.outro.substr(lineIndex + 1); }
    		var lineStr = this.outro;
    		var chunk = this.lastChunk;
    		do {
    			if (chunk.outro.length > 0) {
    				lineIndex = chunk.outro.lastIndexOf(n);
    				if (lineIndex !== -1)
    					{ return chunk.outro.substr(lineIndex + 1) + lineStr; }
    				lineStr = chunk.outro + lineStr;
    			}

    			if (chunk.content.length > 0) {
    				lineIndex = chunk.content.lastIndexOf(n);
    				if (lineIndex !== -1)
    					{ return chunk.content.substr(lineIndex + 1) + lineStr; }
    				lineStr = chunk.content + lineStr;
    			}

    			if (chunk.intro.length > 0) {
    				lineIndex = chunk.intro.lastIndexOf(n);
    				if (lineIndex !== -1)
    					{ return chunk.intro.substr(lineIndex + 1) + lineStr; }
    				lineStr = chunk.intro + lineStr;
    			}
    		} while (chunk = chunk.previous);
    		lineIndex = this.intro.lastIndexOf(n);
    		if (lineIndex !== -1)
    			{ return this.intro.substr(lineIndex + 1) + lineStr; }
    		return this.intro + lineStr;
    	};

    	MagicString.prototype.slice = function slice (start, end) {
    			if ( start === void 0 ) start = 0;
    			if ( end === void 0 ) end = this.original.length;

    		while (start < 0) { start += this.original.length; }
    		while (end < 0) { end += this.original.length; }

    		var result = '';

    		// find start chunk
    		var chunk = this.firstChunk;
    		while (chunk && (chunk.start > start || chunk.end <= start)) {
    			// found end chunk before start
    			if (chunk.start < end && chunk.end >= end) {
    				return result;
    			}

    			chunk = chunk.next;
    		}

    		if (chunk && chunk.edited && chunk.start !== start)
    			{ throw new Error(("Cannot use replaced character " + start + " as slice start anchor.")); }

    		var startChunk = chunk;
    		while (chunk) {
    			if (chunk.intro && (startChunk !== chunk || chunk.start === start)) {
    				result += chunk.intro;
    			}

    			var containsEnd = chunk.start < end && chunk.end >= end;
    			if (containsEnd && chunk.edited && chunk.end !== end)
    				{ throw new Error(("Cannot use replaced character " + end + " as slice end anchor.")); }

    			var sliceStart = startChunk === chunk ? start - chunk.start : 0;
    			var sliceEnd = containsEnd ? chunk.content.length + end - chunk.end : chunk.content.length;

    			result += chunk.content.slice(sliceStart, sliceEnd);

    			if (chunk.outro && (!containsEnd || chunk.end === end)) {
    				result += chunk.outro;
    			}

    			if (containsEnd) {
    				break;
    			}

    			chunk = chunk.next;
    		}

    		return result;
    	};

    	// TODO deprecate this? not really very useful
    	MagicString.prototype.snip = function snip (start, end) {
    		var clone = this.clone();
    		clone.remove(0, start);
    		clone.remove(end, clone.original.length);

    		return clone;
    	};

    	MagicString.prototype._split = function _split (index) {
    		if (this.byStart[index] || this.byEnd[index]) { return; }

    		var chunk = this.lastSearchedChunk;
    		var searchForward = index > chunk.end;

    		while (chunk) {
    			if (chunk.contains(index)) { return this._splitChunk(chunk, index); }

    			chunk = searchForward ? this.byStart[chunk.end] : this.byEnd[chunk.start];
    		}
    	};

    	MagicString.prototype._splitChunk = function _splitChunk (chunk, index) {
    		if (chunk.edited && chunk.content.length) {
    			// zero-length edited chunks are a special case (overlapping replacements)
    			var loc = getLocator$1(this.original)(index);
    			throw new Error(
    				("Cannot split a chunk that has already been edited (" + (loc.line) + ":" + (loc.column) + " – \"" + (chunk.original) + "\")")
    			);
    		}

    		var newChunk = chunk.split(index);

    		this.byEnd[index] = chunk;
    		this.byStart[index] = newChunk;
    		this.byEnd[newChunk.end] = newChunk;

    		if (chunk === this.lastChunk) { this.lastChunk = newChunk; }

    		this.lastSearchedChunk = chunk;
    		return true;
    	};

    	MagicString.prototype.toString = function toString () {
    		var str = this.intro;

    		var chunk = this.firstChunk;
    		while (chunk) {
    			str += chunk.toString();
    			chunk = chunk.next;
    		}

    		return str + this.outro;
    	};

    	MagicString.prototype.isEmpty = function isEmpty () {
    		var chunk = this.firstChunk;
    		do {
    			if (chunk.intro.length && chunk.intro.trim() ||
    					chunk.content.length && chunk.content.trim() ||
    					chunk.outro.length && chunk.outro.trim())
    				{ return false; }
    		} while (chunk = chunk.next);
    		return true;
    	};

    	MagicString.prototype.length = function length () {
    		var chunk = this.firstChunk;
    		var length = 0;
    		do {
    			length += chunk.intro.length + chunk.content.length + chunk.outro.length;
    		} while (chunk = chunk.next);
    		return length;
    	};

    	MagicString.prototype.trimLines = function trimLines () {
    		return this.trim('[\\r\\n]');
    	};

    	MagicString.prototype.trim = function trim (charType) {
    		return this.trimStart(charType).trimEnd(charType);
    	};

    	MagicString.prototype.trimEndAborted = function trimEndAborted (charType) {
    		var rx = new RegExp((charType || '\\s') + '+$');

    		this.outro = this.outro.replace(rx, '');
    		if (this.outro.length) { return true; }

    		var chunk = this.lastChunk;

    		do {
    			var end = chunk.end;
    			var aborted = chunk.trimEnd(rx);

    			// if chunk was trimmed, we have a new lastChunk
    			if (chunk.end !== end) {
    				if (this.lastChunk === chunk) {
    					this.lastChunk = chunk.next;
    				}

    				this.byEnd[chunk.end] = chunk;
    				this.byStart[chunk.next.start] = chunk.next;
    				this.byEnd[chunk.next.end] = chunk.next;
    			}

    			if (aborted) { return true; }
    			chunk = chunk.previous;
    		} while (chunk);

    		return false;
    	};

    	MagicString.prototype.trimEnd = function trimEnd (charType) {
    		this.trimEndAborted(charType);
    		return this;
    	};
    	MagicString.prototype.trimStartAborted = function trimStartAborted (charType) {
    		var rx = new RegExp('^' + (charType || '\\s') + '+');

    		this.intro = this.intro.replace(rx, '');
    		if (this.intro.length) { return true; }

    		var chunk = this.firstChunk;

    		do {
    			var end = chunk.end;
    			var aborted = chunk.trimStart(rx);

    			if (chunk.end !== end) {
    				// special case...
    				if (chunk === this.lastChunk) { this.lastChunk = chunk.next; }

    				this.byEnd[chunk.end] = chunk;
    				this.byStart[chunk.next.start] = chunk.next;
    				this.byEnd[chunk.next.end] = chunk.next;
    			}

    			if (aborted) { return true; }
    			chunk = chunk.next;
    		} while (chunk);

    		return false;
    	};

    	MagicString.prototype.trimStart = function trimStart (charType) {
    		this.trimStartAborted(charType);
    		return this;
    	};

    	const UNKNOWN = {};
    	function gather_possible_values(node, set) {
    	    if (node.type === 'Literal') {
    	        set.add(node.value);
    	    }
    	    else if (node.type === 'ConditionalExpression') {
    	        gather_possible_values(node.consequent, set);
    	        gather_possible_values(node.alternate, set);
    	    }
    	    else {
    	        set.add(UNKNOWN);
    	    }
    	}

    	var BlockAppliesToNode;
    	(function (BlockAppliesToNode) {
    	    BlockAppliesToNode[BlockAppliesToNode["NotPossible"] = 0] = "NotPossible";
    	    BlockAppliesToNode[BlockAppliesToNode["Possible"] = 1] = "Possible";
    	    BlockAppliesToNode[BlockAppliesToNode["UnknownSelectorType"] = 2] = "UnknownSelectorType";
    	})(BlockAppliesToNode || (BlockAppliesToNode = {}));
    	class Selector$1 {
    	    constructor(node, stylesheet) {
    	        this.node = node;
    	        this.stylesheet = stylesheet;
    	        this.blocks = group_selectors(node);
    	        // take trailing :global(...) selectors out of consideration
    	        let i = this.blocks.length;
    	        while (i > 0) {
    	            if (!this.blocks[i - 1].global)
    	                break;
    	            i -= 1;
    	        }
    	        this.local_blocks = this.blocks.slice(0, i);
    	        this.used = this.blocks[0].global;
    	    }
    	    apply(node, stack) {
    	        const to_encapsulate = [];
    	        apply_selector(this.local_blocks.slice(), node, stack.slice(), to_encapsulate);
    	        if (to_encapsulate.length > 0) {
    	            to_encapsulate.forEach(({ node, block }) => {
    	                this.stylesheet.nodes_with_css_class.add(node);
    	                block.should_encapsulate = true;
    	            });
    	            this.used = true;
    	        }
    	    }
    	    minify(code) {
    	        let c = null;
    	        this.blocks.forEach((block, i) => {
    	            if (i > 0) {
    	                if (block.start - c > 1) {
    	                    code.overwrite(c, block.start, block.combinator.name || ' ');
    	                }
    	            }
    	            c = block.end;
    	        });
    	    }
    	    transform(code, attr) {
    	        function encapsulate_block(block) {
    	            let i = block.selectors.length;
    	            while (i--) {
    	                const selector = block.selectors[i];
    	                if (selector.type === 'PseudoElementSelector' || selector.type === 'PseudoClassSelector') {
    	                    if (selector.name !== 'root') {
    	                        if (i === 0)
    	                            code.prependRight(selector.start, attr);
    	                    }
    	                    continue;
    	                }
    	                if (selector.type === 'TypeSelector' && selector.name === '*') {
    	                    code.overwrite(selector.start, selector.end, attr);
    	                }
    	                else {
    	                    code.appendLeft(selector.end, attr);
    	                }
    	                break;
    	            }
    	        }
    	        this.blocks.forEach((block) => {
    	            if (block.global) {
    	                const selector = block.selectors[0];
    	                const first = selector.children[0];
    	                const last = selector.children[selector.children.length - 1];
    	                code.remove(selector.start, first.start).remove(last.end, selector.end);
    	            }
    	            if (block.should_encapsulate)
    	                encapsulate_block(block);
    	        });
    	    }
    	    validate(component) {
    	        this.blocks.forEach((block) => {
    	            let i = block.selectors.length;
    	            while (i-- > 1) {
    	                const selector = block.selectors[i];
    	                if (selector.type === 'PseudoClassSelector' && selector.name === 'global') {
    	                    component.error(selector, {
    	                        code: `css-invalid-global`,
    	                        message: `:global(...) must be the first element in a compound selector`
    	                    });
    	                }
    	            }
    	        });
    	        let start = 0;
    	        let end = this.blocks.length;
    	        for (; start < end; start += 1) {
    	            if (!this.blocks[start].global)
    	                break;
    	        }
    	        for (; end > start; end -= 1) {
    	            if (!this.blocks[end - 1].global)
    	                break;
    	        }
    	        for (let i = start; i < end; i += 1) {
    	            if (this.blocks[i].global) {
    	                component.error(this.blocks[i].selectors[0], {
    	                    code: `css-invalid-global`,
    	                    message: `:global(...) can be at the start or end of a selector sequence, but not in the middle`
    	                });
    	            }
    	        }
    	    }
    	}
    	function apply_selector(blocks, node, stack, to_encapsulate) {
    	    const block = blocks.pop();
    	    if (!block)
    	        return false;
    	    if (!node) {
    	        return blocks.every(block => block.global);
    	    }
    	    switch (block_might_apply_to_node(block, node)) {
    	        case BlockAppliesToNode.NotPossible:
    	            return false;
    	        case BlockAppliesToNode.UnknownSelectorType:
    	            // bail. TODO figure out what these could be
    	            to_encapsulate.push({ node, block });
    	            return true;
    	    }
    	    if (block.combinator) {
    	        if (block.combinator.type === 'WhiteSpace') {
    	            for (const ancestor_block of blocks) {
    	                if (ancestor_block.global) {
    	                    continue;
    	                }
    	                for (const stack_node of stack) {
    	                    if (block_might_apply_to_node(ancestor_block, stack_node) !== BlockAppliesToNode.NotPossible) {
    	                        to_encapsulate.push({ node: stack_node, block: ancestor_block });
    	                    }
    	                }
    	                if (to_encapsulate.length) {
    	                    to_encapsulate.push({ node, block });
    	                    return true;
    	                }
    	            }
    	            if (blocks.every(block => block.global)) {
    	                to_encapsulate.push({ node, block });
    	                return true;
    	            }
    	            return false;
    	        }
    	        else if (block.combinator.name === '>') {
    	            if (apply_selector(blocks, stack.pop(), stack, to_encapsulate)) {
    	                to_encapsulate.push({ node, block });
    	                return true;
    	            }
    	            return false;
    	        }
    	        // TODO other combinators
    	        to_encapsulate.push({ node, block });
    	        return true;
    	    }
    	    to_encapsulate.push({ node, block });
    	    return true;
    	}
    	function block_might_apply_to_node(block, node) {
    	    let i = block.selectors.length;
    	    while (i--) {
    	        const selector = block.selectors[i];
    	        const name = typeof selector.name === 'string' && selector.name.replace(/\\(.)/g, '$1');
    	        if (selector.type === 'PseudoClassSelector' || selector.type === 'PseudoElementSelector') {
    	            continue;
    	        }
    	        if (selector.type === 'PseudoClassSelector' && name === 'global') {
    	            // TODO shouldn't see this here... maybe we should enforce that :global(...)
    	            // cannot be sandwiched between non-global selectors?
    	            return BlockAppliesToNode.NotPossible;
    	        }
    	        if (selector.type === 'ClassSelector') {
    	            if (!attribute_matches(node, 'class', name, '~=', false) && !node.classes.some(c => c.name === name))
    	                return BlockAppliesToNode.NotPossible;
    	        }
    	        else if (selector.type === 'IdSelector') {
    	            if (!attribute_matches(node, 'id', name, '=', false))
    	                return BlockAppliesToNode.NotPossible;
    	        }
    	        else if (selector.type === 'AttributeSelector') {
    	            if (!attribute_matches(node, selector.name.name, selector.value && unquote(selector.value), selector.matcher, selector.flags))
    	                return BlockAppliesToNode.NotPossible;
    	        }
    	        else if (selector.type === 'TypeSelector') {
    	            if (node.name.toLowerCase() !== name.toLowerCase() && name !== '*')
    	                return BlockAppliesToNode.NotPossible;
    	        }
    	        else {
    	            return BlockAppliesToNode.UnknownSelectorType;
    	        }
    	    }
    	    return BlockAppliesToNode.Possible;
    	}
    	function test_attribute(operator, expected_value, case_insensitive, value) {
    	    if (case_insensitive) {
    	        expected_value = expected_value.toLowerCase();
    	        value = value.toLowerCase();
    	    }
    	    switch (operator) {
    	        case '=': return value === expected_value;
    	        case '~=': return ` ${value} `.includes(` ${expected_value} `);
    	        case '|=': return `${value}-`.startsWith(`${expected_value}-`);
    	        case '^=': return value.startsWith(expected_value);
    	        case '$=': return value.endsWith(expected_value);
    	        case '*=': return value.includes(expected_value);
    	        default: throw new Error(`this shouldn't happen`);
    	    }
    	}
    	function attribute_matches(node, name, expected_value, operator, case_insensitive) {
    	    const spread = node.attributes.find(attr => attr.type === 'Spread');
    	    if (spread)
    	        return true;
    	    if (node.bindings.some((binding) => binding.name === name))
    	        return true;
    	    const attr = node.attributes.find((attr) => attr.name === name);
    	    if (!attr)
    	        return false;
    	    if (attr.is_true)
    	        return operator === null;
    	    if (!expected_value)
    	        return true;
    	    if (attr.chunks.length === 1) {
    	        const value = attr.chunks[0];
    	        if (!value)
    	            return false;
    	        if (value.type === 'Text')
    	            return test_attribute(operator, expected_value, case_insensitive, value.data);
    	    }
    	    const possible_values = new Set();
    	    let prev_values = [];
    	    for (const chunk of attr.chunks) {
    	        const current_possible_values = new Set();
    	        if (chunk.type === 'Text') {
    	            current_possible_values.add(chunk.data);
    	        }
    	        else {
    	            gather_possible_values(chunk.node, current_possible_values);
    	        }
    	        // impossible to find out all combinations
    	        if (current_possible_values.has(UNKNOWN))
    	            return true;
    	        if (prev_values.length > 0) {
    	            const start_with_space = [];
    	            const remaining = [];
    	            current_possible_values.forEach((current_possible_value) => {
    	                if (/^\s/.test(current_possible_value)) {
    	                    start_with_space.push(current_possible_value);
    	                }
    	                else {
    	                    remaining.push(current_possible_value);
    	                }
    	            });
    	            if (remaining.length > 0) {
    	                if (start_with_space.length > 0) {
    	                    prev_values.forEach(prev_value => possible_values.add(prev_value));
    	                }
    	                const combined = [];
    	                prev_values.forEach((prev_value) => {
    	                    remaining.forEach((value) => {
    	                        combined.push(prev_value + value);
    	                    });
    	                });
    	                prev_values = combined;
    	                start_with_space.forEach((value) => {
    	                    if (/\s$/.test(value)) {
    	                        possible_values.add(value);
    	                    }
    	                    else {
    	                        prev_values.push(value);
    	                    }
    	                });
    	                continue;
    	            }
    	            else {
    	                prev_values.forEach(prev_value => possible_values.add(prev_value));
    	                prev_values = [];
    	            }
    	        }
    	        current_possible_values.forEach((current_possible_value) => {
    	            if (/\s$/.test(current_possible_value)) {
    	                possible_values.add(current_possible_value);
    	            }
    	            else {
    	                prev_values.push(current_possible_value);
    	            }
    	        });
    	        if (prev_values.length < current_possible_values.size) {
    	            prev_values.push(' ');
    	        }
    	        if (prev_values.length > 20) {
    	            // might grow exponentially, bail out
    	            return true;
    	        }
    	    }
    	    prev_values.forEach(prev_value => possible_values.add(prev_value));
    	    if (possible_values.has(UNKNOWN))
    	        return true;
    	    for (const value of possible_values) {
    	        if (test_attribute(operator, expected_value, case_insensitive, value))
    	            return true;
    	    }
    	    return false;
    	}
    	function unquote(value) {
    	    if (value.type === 'Identifier')
    	        return value.name;
    	    const str = value.value;
    	    if (str[0] === str[str.length - 1] && str[0] === "'" || str[0] === '"') {
    	        return str.slice(1, str.length - 1);
    	    }
    	    return str;
    	}
    	class Block$2 {
    	    constructor(combinator) {
    	        this.combinator = combinator;
    	        this.global = false;
    	        this.selectors = [];
    	        this.start = null;
    	        this.end = null;
    	        this.should_encapsulate = false;
    	    }
    	    add(selector) {
    	        if (this.selectors.length === 0) {
    	            this.start = selector.start;
    	            this.global = selector.type === 'PseudoClassSelector' && selector.name === 'global';
    	        }
    	        this.selectors.push(selector);
    	        this.end = selector.end;
    	    }
    	}
    	function group_selectors(selector) {
    	    let block = new Block$2(null);
    	    const blocks = [block];
    	    selector.children.forEach((child) => {
    	        if (child.type === 'WhiteSpace' || child.type === 'Combinator') {
    	            block = new Block$2(child);
    	            blocks.push(block);
    	        }
    	        else {
    	            block.add(child);
    	        }
    	    });
    	    return blocks;
    	}

    	function remove_css_prefix(name) {
    	    return name.replace(/^-((webkit)|(moz)|(o)|(ms))-/, '');
    	}
    	const is_keyframes_node = (node) => remove_css_prefix(node.name) === 'keyframes';
    	const at_rule_has_declaration = ({ block }) => block &&
    	    block.children &&
    	    block.children.find((node) => node.type === 'Declaration');
    	function minify_declarations(code, start, declarations) {
    	    let c = start;
    	    declarations.forEach((declaration, i) => {
    	        const separator = i > 0 ? ';' : '';
    	        if ((declaration.node.start - c) > separator.length) {
    	            code.overwrite(c, declaration.node.start, separator);
    	        }
    	        declaration.minify(code);
    	        c = declaration.node.end;
    	    });
    	    return c;
    	}
    	// https://github.com/darkskyapp/string-hash/blob/master/index.js
    	function hash(str) {
    	    let hash = 5381;
    	    let i = str.length;
    	    while (i--)
    	        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    	    return (hash >>> 0).toString(36);
    	}
    	class Rule$1 {
    	    constructor(node, stylesheet, parent) {
    	        this.node = node;
    	        this.parent = parent;
    	        this.selectors = node.selector.children.map((node) => new Selector$1(node, stylesheet));
    	        this.declarations = node.block.children.map((node) => new Declaration$1(node));
    	    }
    	    apply(node, stack) {
    	        this.selectors.forEach(selector => selector.apply(node, stack)); // TODO move the logic in here?
    	    }
    	    is_used(dev) {
    	        if (this.parent && this.parent.node.type === 'Atrule' && is_keyframes_node(this.parent.node))
    	            return true;
    	        if (this.declarations.length === 0)
    	            return dev;
    	        return this.selectors.some(s => s.used);
    	    }
    	    minify(code, _dev) {
    	        let c = this.node.start;
    	        let started = false;
    	        this.selectors.forEach((selector) => {
    	            if (selector.used) {
    	                const separator = started ? ',' : '';
    	                if ((selector.node.start - c) > separator.length) {
    	                    code.overwrite(c, selector.node.start, separator);
    	                }
    	                selector.minify(code);
    	                c = selector.node.end;
    	                started = true;
    	            }
    	        });
    	        code.remove(c, this.node.block.start);
    	        c = this.node.block.start + 1;
    	        c = minify_declarations(code, c, this.declarations);
    	        code.remove(c, this.node.block.end - 1);
    	    }
    	    transform(code, id, keyframes) {
    	        if (this.parent && this.parent.node.type === 'Atrule' && is_keyframes_node(this.parent.node))
    	            return true;
    	        const attr = `.${id}`;
    	        this.selectors.forEach(selector => selector.transform(code, attr));
    	        this.declarations.forEach(declaration => declaration.transform(code, keyframes));
    	    }
    	    validate(component) {
    	        this.selectors.forEach(selector => {
    	            selector.validate(component);
    	        });
    	    }
    	    warn_on_unused_selector(handler) {
    	        this.selectors.forEach(selector => {
    	            if (!selector.used)
    	                handler(selector);
    	        });
    	    }
    	}
    	class Declaration$1 {
    	    constructor(node) {
    	        this.node = node;
    	    }
    	    transform(code, keyframes) {
    	        const property = this.node.property && remove_css_prefix(this.node.property.toLowerCase());
    	        if (property === 'animation' || property === 'animation-name') {
    	            this.node.value.children.forEach((block) => {
    	                if (block.type === 'Identifier') {
    	                    const name = block.name;
    	                    if (keyframes.has(name)) {
    	                        code.overwrite(block.start, block.end, keyframes.get(name));
    	                    }
    	                }
    	            });
    	        }
    	    }
    	    minify(code) {
    	        if (!this.node.property)
    	            return; // @apply, and possibly other weird cases?
    	        const c = this.node.start + this.node.property.length;
    	        const first = this.node.value.children
    	            ? this.node.value.children[0]
    	            : this.node.value;
    	        let start = first.start;
    	        while (/\s/.test(code.original[start]))
    	            start += 1;
    	        if (start - c > 1) {
    	            code.overwrite(c, start, ':');
    	        }
    	    }
    	}
    	class Atrule$1 {
    	    constructor(node) {
    	        this.node = node;
    	        this.children = [];
    	        this.declarations = [];
    	    }
    	    apply(node, stack) {
    	        if (this.node.name === 'media' || this.node.name === 'supports') {
    	            this.children.forEach(child => {
    	                child.apply(node, stack);
    	            });
    	        }
    	        else if (is_keyframes_node(this.node)) {
    	            this.children.forEach((rule) => {
    	                rule.selectors.forEach(selector => {
    	                    selector.used = true;
    	                });
    	            });
    	        }
    	    }
    	    is_used(_dev) {
    	        return true; // TODO
    	    }
    	    minify(code, dev) {
    	        if (this.node.name === 'media') {
    	            const expression_char = code.original[this.node.expression.start];
    	            let c = this.node.start + (expression_char === '(' ? 6 : 7);
    	            if (this.node.expression.start > c)
    	                code.remove(c, this.node.expression.start);
    	            this.node.expression.children.forEach((query) => {
    	                // TODO minify queries
    	                c = query.end;
    	            });
    	            code.remove(c, this.node.block.start);
    	        }
    	        else if (this.node.name === 'supports') {
    	            let c = this.node.start + 9;
    	            if (this.node.expression.start - c > 1)
    	                code.overwrite(c, this.node.expression.start, ' ');
    	            this.node.expression.children.forEach((query) => {
    	                // TODO minify queries
    	                c = query.end;
    	            });
    	            code.remove(c, this.node.block.start);
    	        }
    	        else {
    	            let c = this.node.start + this.node.name.length + 1;
    	            if (this.node.expression) {
    	                if (this.node.expression.start - c > 1)
    	                    code.overwrite(c, this.node.expression.start, ' ');
    	                c = this.node.expression.end;
    	            }
    	            if (this.node.block && this.node.block.start - c > 0) {
    	                code.remove(c, this.node.block.start);
    	            }
    	        }
    	        // TODO other atrules
    	        if (this.node.block) {
    	            let c = this.node.block.start + 1;
    	            if (this.declarations.length) {
    	                c = minify_declarations(code, c, this.declarations);
    	                // if the atrule has children, leave the last declaration semicolon alone
    	                if (this.children.length)
    	                    c++;
    	            }
    	            this.children.forEach(child => {
    	                if (child.is_used(dev)) {
    	                    code.remove(c, child.node.start);
    	                    child.minify(code, dev);
    	                    c = child.node.end;
    	                }
    	            });
    	            code.remove(c, this.node.block.end - 1);
    	        }
    	    }
    	    transform(code, id, keyframes) {
    	        if (is_keyframes_node(this.node)) {
    	            this.node.expression.children.forEach(({ type, name, start, end }) => {
    	                if (type === 'Identifier') {
    	                    if (name.startsWith('-global-')) {
    	                        code.remove(start, start + 8);
    	                        this.children.forEach((rule) => {
    	                            rule.selectors.forEach(selector => {
    	                                selector.used = true;
    	                            });
    	                        });
    	                    }
    	                    else {
    	                        code.overwrite(start, end, keyframes.get(name));
    	                    }
    	                }
    	            });
    	        }
    	        this.children.forEach(child => {
    	            child.transform(code, id, keyframes);
    	        });
    	    }
    	    validate(component) {
    	        this.children.forEach(child => {
    	            child.validate(component);
    	        });
    	    }
    	    warn_on_unused_selector(handler) {
    	        if (this.node.name !== 'media')
    	            return;
    	        this.children.forEach(child => {
    	            child.warn_on_unused_selector(handler);
    	        });
    	    }
    	}
    	class Stylesheet {
    	    constructor(source, ast, filename, dev) {
    	        this.children = [];
    	        this.keyframes = new Map();
    	        this.nodes_with_css_class = new Set();
    	        this.source = source;
    	        this.ast = ast;
    	        this.filename = filename;
    	        this.dev = dev;
    	        if (ast.css && ast.css.children.length) {
    	            this.id = `svelte-${hash(ast.css.content.styles)}`;
    	            this.has_styles = true;
    	            const stack = [];
    	            let depth = 0;
    	            let current_atrule = null;
    	            walk(ast.css, {
    	                enter: (node) => {
    	                    if (node.type === 'Atrule') {
    	                        const atrule = new Atrule$1(node);
    	                        stack.push(atrule);
    	                        if (current_atrule) {
    	                            current_atrule.children.push(atrule);
    	                        }
    	                        else if (depth <= 1) {
    	                            this.children.push(atrule);
    	                        }
    	                        if (is_keyframes_node(node)) {
    	                            node.expression.children.forEach((expression) => {
    	                                if (expression.type === 'Identifier' && !expression.name.startsWith('-global-')) {
    	                                    this.keyframes.set(expression.name, `${this.id}-${expression.name}`);
    	                                }
    	                            });
    	                        }
    	                        else if (at_rule_has_declaration(node)) {
    	                            const at_rule_declarations = node.block.children
    	                                .filter(node => node.type === 'Declaration')
    	                                .map(node => new Declaration$1(node));
    	                            atrule.declarations.push(...at_rule_declarations);
    	                        }
    	                        current_atrule = atrule;
    	                    }
    	                    if (node.type === 'Rule') {
    	                        const rule = new Rule$1(node, this, current_atrule);
    	                        if (current_atrule) {
    	                            current_atrule.children.push(rule);
    	                        }
    	                        else if (depth <= 1) {
    	                            this.children.push(rule);
    	                        }
    	                    }
    	                    depth += 1;
    	                },
    	                leave: (node) => {
    	                    if (node.type === 'Atrule') {
    	                        stack.pop();
    	                        current_atrule = stack[stack.length - 1];
    	                    }
    	                    depth -= 1;
    	                }
    	            });
    	        }
    	        else {
    	            this.has_styles = false;
    	        }
    	    }
    	    apply(node) {
    	        if (!this.has_styles)
    	            return;
    	        const stack = [];
    	        let parent = node;
    	        while (parent = parent.parent) {
    	            if (parent.type === 'Element')
    	                stack.unshift(parent);
    	        }
    	        for (let i = 0; i < this.children.length; i += 1) {
    	            const child = this.children[i];
    	            child.apply(node, stack);
    	        }
    	    }
    	    reify() {
    	        this.nodes_with_css_class.forEach((node) => {
    	            node.add_css_class();
    	        });
    	    }
    	    render(file, should_transform_selectors) {
    	        if (!this.has_styles) {
    	            return { code: null, map: null };
    	        }
    	        const code = new MagicString(this.source);
    	        walk(this.ast.css, {
    	            enter: (node) => {
    	                code.addSourcemapLocation(node.start);
    	                code.addSourcemapLocation(node.end);
    	            }
    	        });
    	        if (should_transform_selectors) {
    	            this.children.forEach((child) => {
    	                child.transform(code, this.id, this.keyframes);
    	            });
    	        }
    	        let c = 0;
    	        this.children.forEach(child => {
    	            if (child.is_used(this.dev)) {
    	                code.remove(c, child.node.start);
    	                child.minify(code, this.dev);
    	                c = child.node.end;
    	            }
    	        });
    	        code.remove(c, this.source.length);
    	        return {
    	            code: code.toString(),
    	            map: code.generateMap({
    	                includeContent: true,
    	                source: this.filename,
    	                file
    	            })
    	        };
    	    }
    	    validate(component) {
    	        this.children.forEach(child => {
    	            child.validate(component);
    	        });
    	    }
    	    warn_on_unused_selectors(component) {
    	        this.children.forEach(child => {
    	            child.warn_on_unused_selector((selector) => {
    	                component.warn(selector.node, {
    	                    code: `css-unused-selector`,
    	                    message: `Unused CSS selector`
    	                });
    	            });
    	        });
    	    }
    	}

    	const test = typeof process !== 'undefined' && process.env.TEST;

    	class Node$1 {
    	    constructor(component, parent, _scope, info) {
    	        this.start = info.start;
    	        this.end = info.end;
    	        this.type = info.type;
    	        // this makes properties non-enumerable, which makes logging
    	        // bearable. might have a performance cost. TODO remove in prod?
    	        Object.defineProperties(this, {
    	            component: {
    	                value: component
    	            },
    	            parent: {
    	                value: parent
    	            }
    	        });
    	    }
    	    cannot_use_innerhtml() {
    	        if (this.can_use_innerhtml !== false) {
    	            this.can_use_innerhtml = false;
    	            if (this.parent)
    	                this.parent.cannot_use_innerhtml();
    	        }
    	    }
    	    find_nearest(selector) {
    	        if (selector.test(this.type))
    	            return this;
    	        if (this.parent)
    	            return this.parent.find_nearest(selector);
    	    }
    	    get_static_attribute_value(name) {
    	        const attribute = this.attributes && this.attributes.find((attr) => attr.type === 'Attribute' && attr.name.toLowerCase() === name);
    	        if (!attribute)
    	            return null;
    	        if (attribute.is_true)
    	            return true;
    	        if (attribute.chunks.length === 0)
    	            return '';
    	        if (attribute.chunks.length === 1 && attribute.chunks[0].type === 'Text') {
    	            return attribute.chunks[0].data;
    	        }
    	        return null;
    	    }
    	    has_ancestor(type) {
    	        return this.parent ?
    	            this.parent.type === type || this.parent.has_ancestor(type) :
    	            false;
    	    }
    	}

    	class AbstractBlock extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	    }
    	    warn_if_empty_block() {
    	        if (!this.children || this.children.length > 1)
    	            return;
    	        const child = this.children[0];
    	        if (!child || (child.type === 'Text' && !/[^ \r\n\f\v\t]/.test(child.data))) {
    	            this.component.warn(this, {
    	                code: 'empty-block',
    	                message: 'Empty block'
    	            });
    	        }
    	    }
    	}

    	class PendingBlock extends AbstractBlock {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.children = map_children(component, parent, scope, info.children);
    	        if (!info.skip) {
    	            this.warn_if_empty_block();
    	        }
    	    }
    	}

    	class ThenBlock extends AbstractBlock {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.scope = scope.child();
    	        this.scope.add(parent.value, parent.expression.dependencies, this);
    	        this.children = map_children(component, parent, this.scope, info.children);
    	        if (!info.skip) {
    	            this.warn_if_empty_block();
    	        }
    	    }
    	}

    	class CatchBlock extends AbstractBlock {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.scope = scope.child();
    	        this.scope.add(parent.error, parent.expression.dependencies, this);
    	        this.children = map_children(component, parent, this.scope, info.children);
    	        if (!info.skip) {
    	            this.warn_if_empty_block();
    	        }
    	    }
    	}

    	class Expression {
    	    // todo: owner type
    	    constructor(component, owner, template_scope, info, lazy) {
    	        this.type = 'Expression';
    	        this.dependencies = new Set();
    	        this.contextual_dependencies = new Set();
    	        this.declarations = [];
    	        this.uses_context = false;
    	        // TODO revert to direct property access in prod?
    	        Object.defineProperties(this, {
    	            component: {
    	                value: component
    	            }
    	        });
    	        this.node = info;
    	        this.template_scope = template_scope;
    	        this.owner = owner;
    	        const { dependencies, contextual_dependencies } = this;
    	        let { map, scope } = create_scopes(info);
    	        this.scope = scope;
    	        this.scope_map = map;
    	        const expression = this;
    	        let function_expression;
    	        // discover dependencies, but don't change the code yet
    	        walk(info, {
    	            enter(node, parent, key) {
    	                // don't manipulate shorthand props twice
    	                if (key === 'value' && parent.shorthand)
    	                    return;
    	                if (map.has(node)) {
    	                    scope = map.get(node);
    	                }
    	                if (!function_expression && /FunctionExpression/.test(node.type)) {
    	                    function_expression = node;
    	                }
    	                if (isReference(node, parent)) {
    	                    const { name, nodes } = flatten_reference(node);
    	                    if (scope.has(name))
    	                        return;
    	                    if (name[0] === '$' && template_scope.names.has(name.slice(1))) {
    	                        component.error(node, {
    	                            code: `contextual-store`,
    	                            message: `Stores must be declared at the top level of the component (this may change in a future version of Svelte)`
    	                        });
    	                    }
    	                    if (template_scope.is_let(name)) {
    	                        if (!function_expression) { // TODO should this be `!lazy` ?
    	                            contextual_dependencies.add(name);
    	                            dependencies.add(name);
    	                        }
    	                    }
    	                    else if (template_scope.names.has(name)) {
    	                        expression.uses_context = true;
    	                        contextual_dependencies.add(name);
    	                        const owner = template_scope.get_owner(name);
    	                        const is_index = owner.type === 'EachBlock' && owner.key && name === owner.index;
    	                        if (!lazy || is_index) {
    	                            template_scope.dependencies_for_name.get(name).forEach(name => dependencies.add(name));
    	                        }
    	                    }
    	                    else {
    	                        if (!lazy) {
    	                            dependencies.add(name);
    	                        }
    	                        component.add_reference(name);
    	                        component.warn_if_undefined(name, nodes[0], template_scope);
    	                    }
    	                    this.skip();
    	                }
    	                // track any assignments from template expressions as mutable
    	                let names;
    	                let deep = false;
    	                if (function_expression) {
    	                    if (node.type === 'AssignmentExpression') {
    	                        deep = node.left.type === 'MemberExpression';
    	                        names = deep
    	                            ? [get_object(node.left).name]
    	                            : extract_names(node.left);
    	                    }
    	                    else if (node.type === 'UpdateExpression') {
    	                        const { name } = get_object(node.argument);
    	                        names = [name];
    	                    }
    	                }
    	                if (names) {
    	                    names.forEach(name => {
    	                        if (template_scope.names.has(name)) {
    	                            template_scope.dependencies_for_name.get(name).forEach(name => {
    	                                const variable = component.var_lookup.get(name);
    	                                if (variable)
    	                                    variable[deep ? 'mutated' : 'reassigned'] = true;
    	                            });
    	                        }
    	                        else {
    	                            component.add_reference(name);
    	                            const variable = component.var_lookup.get(name);
    	                            if (variable)
    	                                variable[deep ? 'mutated' : 'reassigned'] = true;
    	                        }
    	                    });
    	                }
    	            },
    	            leave(node) {
    	                if (map.has(node)) {
    	                    scope = scope.parent;
    	                }
    	                if (node === function_expression) {
    	                    function_expression = null;
    	                }
    	            }
    	        });
    	    }
    	    dynamic_dependencies() {
    	        return Array.from(this.dependencies).filter(name => {
    	            if (this.template_scope.is_let(name))
    	                return true;
    	            if (name === '$$props')
    	                return true;
    	            const variable = this.component.var_lookup.get(name);
    	            return is_dynamic$1(variable);
    	        });
    	    }
    	    // TODO move this into a render-dom wrapper?
    	    manipulate(block) {
    	        // TODO ideally we wouldn't end up calling this method
    	        // multiple times
    	        if (this.manipulated)
    	            return this.manipulated;
    	        const { component, declarations, scope_map: map, template_scope, owner } = this;
    	        let scope = this.scope;
    	        let function_expression;
    	        let dependencies;
    	        let contextual_dependencies;
    	        const node = walk(this.node, {
    	            enter(node, parent) {
    	                if (node.type === 'Property' && node.shorthand) {
    	                    node.value = JSON.parse(JSON.stringify(node.value));
    	                    node.shorthand = false;
    	                }
    	                if (map.has(node)) {
    	                    scope = map.get(node);
    	                }
    	                if (isReference(node, parent)) {
    	                    const { name } = flatten_reference(node);
    	                    if (scope.has(name))
    	                        return;
    	                    if (function_expression) {
    	                        if (template_scope.names.has(name)) {
    	                            contextual_dependencies.add(name);
    	                            template_scope.dependencies_for_name.get(name).forEach(dependency => {
    	                                dependencies.add(dependency);
    	                            });
    	                        }
    	                        else {
    	                            dependencies.add(name);
    	                            component.add_reference(name); // TODO is this redundant/misplaced?
    	                        }
    	                    }
    	                    else if (is_contextual(component, template_scope, name)) {
    	                        const reference = block.renderer.reference(node);
    	                        this.replace(reference);
    	                    }
    	                    this.skip();
    	                }
    	                if (!function_expression) {
    	                    if (node.type === 'AssignmentExpression') ;
    	                    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    	                        function_expression = node;
    	                        dependencies = new Set();
    	                        contextual_dependencies = new Set();
    	                    }
    	                }
    	            },
    	            leave(node, parent) {
    	                if (map.has(node))
    	                    scope = scope.parent;
    	                if (node === function_expression) {
    	                    const id = component.get_unique_name(sanitize(get_function_name(node, owner)));
    	                    const declaration = b `const ${id} = ${node}`;
    	                    if (dependencies.size === 0 && contextual_dependencies.size === 0) {
    	                        // we can hoist this out of the component completely
    	                        component.fully_hoisted.push(declaration);
    	                        this.replace(id);
    	                        component.add_var({
    	                            name: id.name,
    	                            internal: true,
    	                            hoistable: true,
    	                            referenced: true
    	                        });
    	                    }
    	                    else if (contextual_dependencies.size === 0) {
    	                        // function can be hoisted inside the component init
    	                        component.partly_hoisted.push(declaration);
    	                        block.renderer.add_to_context(id.name);
    	                        this.replace(block.renderer.reference(id));
    	                    }
    	                    else {
    	                        // we need a combo block/init recipe
    	                        const deps = Array.from(contextual_dependencies);
    	                        node.params = [
    	                            ...deps.map(name => ({ type: 'Identifier', name })),
    	                            ...node.params
    	                        ];
    	                        const context_args = deps.map(name => block.renderer.reference(name));
    	                        component.partly_hoisted.push(declaration);
    	                        block.renderer.add_to_context(id.name);
    	                        const callee = block.renderer.reference(id);
    	                        this.replace(id);
    	                        if (node.params.length > 0) {
    	                            declarations.push(b `
								function ${id}(...args) {
									return ${callee}(${context_args}, ...args);
								}
							`);
    	                        }
    	                        else {
    	                            declarations.push(b `
								function ${id}() {
									return ${callee}(${context_args});
								}
							`);
    	                        }
    	                    }
    	                    function_expression = null;
    	                    dependencies = null;
    	                    contextual_dependencies = null;
    	                    if (parent && parent.type === 'Property') {
    	                        parent.method = false;
    	                    }
    	                }
    	                if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
    	                    const assignee = node.type === 'AssignmentExpression' ? node.left : node.argument;
    	                    // normally (`a = 1`, `b.c = 2`), there'll be a single name
    	                    // (a or b). In destructuring cases (`[d, e] = [e, d]`) there
    	                    // may be more, in which case we need to tack the extra ones
    	                    // onto the initial function call
    	                    const names = new Set(extract_names(assignee));
    	                    const traced = new Set();
    	                    names.forEach(name => {
    	                        const dependencies = template_scope.dependencies_for_name.get(name);
    	                        if (dependencies) {
    	                            dependencies.forEach(name => traced.add(name));
    	                        }
    	                        else {
    	                            traced.add(name);
    	                        }
    	                    });
    	                    this.replace(invalidate(block.renderer, scope, node, traced));
    	                }
    	            }
    	        });
    	        if (declarations.length > 0) {
    	            block.maintain_context = true;
    	            declarations.forEach(declaration => {
    	                block.chunks.init.push(declaration);
    	            });
    	        }
    	        return (this.manipulated = node);
    	    }
    	}
    	function get_function_name(_node, parent) {
    	    if (parent.type === 'EventHandler') {
    	        return `${parent.name}_handler`;
    	    }
    	    if (parent.type === 'Action') {
    	        return `${parent.name}_function`;
    	    }
    	    return 'func';
    	}
    	function is_contextual(component, scope, name) {
    	    if (name === '$$props')
    	        return true;
    	    // if it's a name below root scope, it's contextual
    	    if (!scope.is_top_level(name))
    	        return true;
    	    const variable = component.var_lookup.get(name);
    	    // hoistables, module declarations, and imports are non-contextual
    	    if (!variable || variable.hoistable)
    	        return false;
    	    // assume contextual
    	    return true;
    	}

    	class AwaitBlock$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.expression = new Expression(component, this, scope, info.expression);
    	        this.value = info.value;
    	        this.error = info.error;
    	        this.pending = new PendingBlock(component, this, scope, info.pending);
    	        this.then = new ThenBlock(component, this, scope, info.then);
    	        this.catch = new CatchBlock(component, this, scope, info.catch);
    	    }
    	}

    	class EventHandler extends Node$1 {
    	    constructor(component, parent, template_scope, info) {
    	        super(component, parent, template_scope, info);
    	        this.uses_context = false;
    	        this.can_make_passive = false;
    	        this.name = info.name;
    	        this.modifiers = new Set(info.modifiers);
    	        if (info.expression) {
    	            this.expression = new Expression(component, this, template_scope, info.expression);
    	            this.uses_context = this.expression.uses_context;
    	            if (/FunctionExpression/.test(info.expression.type) && info.expression.params.length === 0) {
    	                // TODO make this detection more accurate — if `event.preventDefault` isn't called, and
    	                // `event` is passed to another function, we can make it passive
    	                this.can_make_passive = true;
    	            }
    	            else if (info.expression.type === 'Identifier') {
    	                let node = component.node_for_declaration.get(info.expression.name);
    	                if (node) {
    	                    if (node.type === 'VariableDeclaration') {
    	                        // for `const handleClick = () => {...}`, we want the [arrow] function expression node
    	                        const declarator = node.declarations.find(d => d.id.name === info.expression.name);
    	                        node = declarator && declarator.init;
    	                    }
    	                    if (node && (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunctionExpression') && node.params.length === 0) {
    	                        this.can_make_passive = true;
    	                    }
    	                    this.reassigned = component.var_lookup.get(info.expression.name).reassigned;
    	                }
    	            }
    	            else if (this.expression.dynamic_dependencies().length > 0) {
    	                this.reassigned = true;
    	            }
    	        }
    	        else {
    	            this.handler_name = component.get_unique_name(`${sanitize(this.name)}_handler`);
    	        }
    	    }
    	}

    	class Body extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.handlers = [];
    	        info.attributes.forEach(node => {
    	            if (node.type === 'EventHandler') {
    	                this.handlers.push(new EventHandler(component, this, scope, node));
    	            }
    	        });
    	    }
    	}

    	const pattern = /^\s*svelte-ignore\s+([\s\S]+)\s*$/m;
    	class Comment$2 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.data = info.data;
    	        const match = pattern.exec(this.data);
    	        this.ignores = match ? match[1].split(/[^\S]/).map(x => x.trim()).filter(Boolean) : [];
    	    }
    	}

    	class ElseBlock extends AbstractBlock {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.children = map_children(component, this, scope, info.children);
    	        this.warn_if_empty_block();
    	    }
    	}

    	function unpack_destructuring(contexts, node, modifier) {
    	    if (!node)
    	        return;
    	    if (node.type === 'Identifier' || node.type === 'RestIdentifier') { // TODO is this right? not RestElement?
    	        contexts.push({
    	            key: node,
    	            modifier
    	        });
    	    }
    	    else if (node.type === 'ArrayPattern') {
    	        node.elements.forEach((element, i) => {
    	            if (element && element.type === 'RestIdentifier') {
    	                unpack_destructuring(contexts, element, node => x `${modifier(node)}.slice(${i})`);
    	            }
    	            else {
    	                unpack_destructuring(contexts, element, node => x `${modifier(node)}[${i}]`);
    	            }
    	        });
    	    }
    	    else if (node.type === 'ObjectPattern') {
    	        const used_properties = [];
    	        node.properties.forEach((property, i) => {
    	            if (property.kind === 'rest') { // TODO is this right?
    	                const replacement = {
    	                    type: 'RestElement',
    	                    argument: property.key
    	                };
    	                node.properties[i] = replacement;
    	                unpack_destructuring(contexts, property.value, node => x `@object_without_properties(${modifier(node)}, [${used_properties}])`);
    	            }
    	            else {
    	                used_properties.push(x `"${property.key.name}"`);
    	                unpack_destructuring(contexts, property.value, node => x `${modifier(node)}.${property.key.name}`);
    	            }
    	        });
    	    }
    	}
    	class EachBlock$1 extends AbstractBlock {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.has_binding = false;
    	        this.expression = new Expression(component, this, scope, info.expression);
    	        this.context = info.context.name || 'each'; // TODO this is used to facilitate binding; currently fails with destructuring
    	        this.context_node = info.context;
    	        this.index = info.index;
    	        this.scope = scope.child();
    	        this.contexts = [];
    	        unpack_destructuring(this.contexts, info.context, node => node);
    	        this.contexts.forEach(context => {
    	            this.scope.add(context.key.name, this.expression.dependencies, this);
    	        });
    	        if (this.index) {
    	            // index can only change if this is a keyed each block
    	            const dependencies = info.key ? this.expression.dependencies : new Set([]);
    	            this.scope.add(this.index, dependencies, this);
    	        }
    	        this.key = info.key
    	            ? new Expression(component, this, this.scope, info.key)
    	            : null;
    	        this.has_animation = false;
    	        this.children = map_children(component, this, this.scope, info.children);
    	        if (this.has_animation) {
    	            if (this.children.length !== 1) {
    	                const child = this.children.find(child => !!child.animation);
    	                component.error(child.animation, {
    	                    code: `invalid-animation`,
    	                    message: `An element that use the animate directive must be the sole child of a keyed each block`
    	                });
    	            }
    	        }
    	        this.warn_if_empty_block();
    	        this.else = info.else
    	            ? new ElseBlock(component, this, this.scope, info.else)
    	            : null;
    	    }
    	}

    	class Attribute extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.scope = scope;
    	        if (info.type === 'Spread') {
    	            this.name = null;
    	            this.is_spread = true;
    	            this.is_true = false;
    	            this.expression = new Expression(component, this, scope, info.expression);
    	            this.dependencies = this.expression.dependencies;
    	            this.chunks = null;
    	            this.is_static = false;
    	        }
    	        else {
    	            this.name = info.name;
    	            this.is_true = info.value === true;
    	            this.is_static = true;
    	            this.dependencies = new Set();
    	            this.chunks = this.is_true
    	                ? []
    	                : info.value.map(node => {
    	                    if (node.type === 'Text')
    	                        return node;
    	                    this.is_static = false;
    	                    const expression = new Expression(component, this, scope, node.expression);
    	                    add_to_set(this.dependencies, expression.dependencies);
    	                    return expression;
    	                });
    	        }
    	    }
    	    get_dependencies() {
    	        if (this.is_spread)
    	            return this.expression.dynamic_dependencies();
    	        const dependencies = new Set();
    	        this.chunks.forEach(chunk => {
    	            if (chunk.type === 'Expression') {
    	                add_to_set(dependencies, chunk.dynamic_dependencies());
    	            }
    	        });
    	        return Array.from(dependencies);
    	    }
    	    get_value(block) {
    	        if (this.is_true)
    	            return x `true`;
    	        if (this.chunks.length === 0)
    	            return x `""`;
    	        if (this.chunks.length === 1) {
    	            return this.chunks[0].type === 'Text'
    	                ? string_literal(this.chunks[0].data)
    	                : this.chunks[0].manipulate(block);
    	        }
    	        let expression = this.chunks
    	            .map(chunk => chunk.type === 'Text' ? string_literal(chunk.data) : chunk.manipulate(block))
    	            .reduce((lhs, rhs) => x `${lhs} + ${rhs}`);
    	        if (this.chunks[0].type !== 'Text') {
    	            expression = x `"" + ${expression}`;
    	        }
    	        return expression;
    	    }
    	    get_static_value() {
    	        if (this.is_spread || this.dependencies.size > 0)
    	            return null;
    	        return this.is_true
    	            ? true
    	            : this.chunks[0]
    	                // method should be called only when `is_static = true`
    	                ? this.chunks[0].data
    	                : '';
    	    }
    	    should_cache() {
    	        return this.is_static
    	            ? false
    	            : this.chunks.length === 1
    	                // @ts-ignore todo: probably error
    	                ? this.chunks[0].node.type !== 'Identifier' || this.scope.names.has(this.chunks[0].node.name)
    	                : true;
    	    }
    	}

    	// TODO this should live in a specific binding
    	const read_only_media_attributes = new Set([
    	    'duration',
    	    'buffered',
    	    'seekable',
    	    'played',
    	    'seeking',
    	    'ended',
    	    'videoHeight',
    	    'videoWidth'
    	]);
    	class Binding extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        if (info.expression.type !== 'Identifier' && info.expression.type !== 'MemberExpression') {
    	            component.error(info, {
    	                code: 'invalid-directive-value',
    	                message: 'Can only bind to an identifier (e.g. `foo`) or a member expression (e.g. `foo.bar` or `foo[baz]`)'
    	            });
    	        }
    	        this.name = info.name;
    	        this.expression = new Expression(component, this, scope, info.expression);
    	        this.raw_expression = JSON.parse(JSON.stringify(info.expression));
    	        const { name } = get_object(this.expression.node);
    	        this.is_contextual = scope.names.has(name);
    	        // make sure we track this as a mutable ref
    	        if (scope.is_let(name)) {
    	            component.error(this, {
    	                code: 'invalid-binding',
    	                message: 'Cannot bind to a variable declared with the let: directive'
    	            });
    	        }
    	        else if (this.is_contextual) {
    	            scope.dependencies_for_name.get(name).forEach(name => {
    	                const variable = component.var_lookup.get(name);
    	                if (variable) {
    	                    variable[this.expression.node.type === 'MemberExpression' ? 'mutated' : 'reassigned'] = true;
    	                }
    	            });
    	        }
    	        else {
    	            const variable = component.var_lookup.get(name);
    	            if (!variable || variable.global)
    	                component.error(this.expression.node, {
    	                    code: 'binding-undeclared',
    	                    message: `${name} is not declared`
    	                });
    	            variable[this.expression.node.type === 'MemberExpression' ? 'mutated' : 'reassigned'] = true;
    	        }
    	        const type = parent.get_static_attribute_value('type');
    	        this.is_readonly = (dimensions.test(this.name) ||
    	            (parent.is_media_node && parent.is_media_node() && read_only_media_attributes.has(this.name)) ||
    	            (parent.name === 'input' && type === 'file') // TODO others?
    	        );
    	    }
    	    is_readonly_media_attribute() {
    	        return read_only_media_attributes.has(this.name);
    	    }
    	}

    	class Transition extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        component.warn_if_undefined(info.name, info, scope);
    	        this.name = info.name;
    	        component.add_reference(info.name.split('.')[0]);
    	        this.directive = info.intro && info.outro ? 'transition' : info.intro ? 'in' : 'out';
    	        this.is_local = info.modifiers.includes('local');
    	        if ((info.intro && parent.intro) || (info.outro && parent.outro)) {
    	            const parent_transition = (parent.intro || parent.outro);
    	            const message = this.directive === parent_transition.directive
    	                ? `An element can only have one '${this.directive}' directive`
    	                : `An element cannot have both ${describe(parent_transition)} directive and ${describe(this)} directive`;
    	            component.error(info, {
    	                code: `duplicate-transition`,
    	                message
    	            });
    	        }
    	        this.expression = info.expression
    	            ? new Expression(component, this, scope, info.expression, true)
    	            : null;
    	    }
    	}
    	function describe(transition) {
    	    return transition.directive === 'transition'
    	        ? `a 'transition'`
    	        : `an '${transition.directive}'`;
    	}

    	class Animation extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        component.warn_if_undefined(info.name, info, scope);
    	        this.name = info.name;
    	        component.add_reference(info.name.split('.')[0]);
    	        if (parent.animation) {
    	            component.error(this, {
    	                code: `duplicate-animation`,
    	                message: `An element can only have one 'animate' directive`
    	            });
    	        }
    	        const block = parent.parent;
    	        if (!block || block.type !== 'EachBlock' || !block.key) {
    	            // TODO can we relax the 'immediate child' rule?
    	            component.error(this, {
    	                code: `invalid-animation`,
    	                message: `An element that use the animate directive must be the immediate child of a keyed each block`
    	            });
    	        }
    	        block.has_animation = true;
    	        this.expression = info.expression
    	            ? new Expression(component, this, scope, info.expression, true)
    	            : null;
    	    }
    	}

    	class Action extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        component.warn_if_undefined(info.name, info, scope);
    	        this.name = info.name;
    	        component.add_reference(info.name.split('.')[0]);
    	        this.expression = info.expression
    	            ? new Expression(component, this, scope, info.expression)
    	            : null;
    	        this.uses_context = this.expression && this.expression.uses_context;
    	    }
    	}

    	class Class extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.name = info.name;
    	        this.expression = info.expression
    	            ? new Expression(component, this, scope, info.expression)
    	            : null;
    	    }
    	}

    	class Text$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.data = info.data;
    	        this.synthetic = info.synthetic || false;
    	    }
    	}

    	const applicable = new Set(['Identifier', 'ObjectExpression', 'ArrayExpression', 'Property']);
    	class Let extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.names = [];
    	        this.name = { type: 'Identifier', name: info.name };
    	        const { names } = this;
    	        if (info.expression) {
    	            this.value = info.expression;
    	            walk(info.expression, {
    	                enter(node) {
    	                    if (!applicable.has(node.type)) {
    	                        component.error(node, {
    	                            code: 'invalid-let',
    	                            message: `let directive value must be an identifier or an object/array pattern`
    	                        });
    	                    }
    	                    if (node.type === 'Identifier') {
    	                        names.push(node.name);
    	                    }
    	                    // slightly unfortunate hack
    	                    if (node.type === 'ArrayExpression') {
    	                        node.type = 'ArrayPattern';
    	                    }
    	                    if (node.type === 'ObjectExpression') {
    	                        node.type = 'ObjectPattern';
    	                    }
    	                }
    	            });
    	        }
    	        else {
    	            names.push(this.name.name);
    	        }
    	    }
    	}

    	const svg$1 = /^(?:altGlyph|altGlyphDef|altGlyphItem|animate|animateColor|animateMotion|animateTransform|circle|clipPath|color-profile|cursor|defs|desc|discard|ellipse|feBlend|feColorMatrix|feComponentTransfer|feComposite|feConvolveMatrix|feDiffuseLighting|feDisplacementMap|feDistantLight|feDropShadow|feFlood|feFuncA|feFuncB|feFuncG|feFuncR|feGaussianBlur|feImage|feMerge|feMergeNode|feMorphology|feOffset|fePointLight|feSpecularLighting|feSpotLight|feTile|feTurbulence|filter|font|font-face|font-face-format|font-face-name|font-face-src|font-face-uri|foreignObject|g|glyph|glyphRef|hatch|hatchpath|hkern|image|line|linearGradient|marker|mask|mesh|meshgradient|meshpatch|meshrow|metadata|missing-glyph|mpath|path|pattern|polygon|polyline|radialGradient|rect|set|solidcolor|stop|svg|switch|symbol|text|textPath|tref|tspan|unknown|use|view|vkern)$/;
    	const aria_attributes = 'activedescendant atomic autocomplete busy checked colindex controls current describedby details disabled dropeffect errormessage expanded flowto grabbed haspopup hidden invalid keyshortcuts label labelledby level live modal multiline multiselectable orientation owns placeholder posinset pressed readonly relevant required roledescription rowindex selected setsize sort valuemax valuemin valuenow valuetext'.split(' ');
    	const aria_attribute_set = new Set(aria_attributes);
    	const aria_roles = 'alert alertdialog application article banner button cell checkbox columnheader combobox command complementary composite contentinfo definition dialog directory document feed figure form grid gridcell group heading img input landmark link list listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox menuitemradio navigation none note option presentation progressbar radio radiogroup range region roletype row rowgroup rowheader scrollbar search searchbox section sectionhead select separator slider spinbutton status structure switch tab table tablist tabpanel term textbox timer toolbar tooltip tree treegrid treeitem widget window'.split(' ');
    	const aria_role_set = new Set(aria_roles);
    	const a11y_required_attributes = {
    	    a: ['href'],
    	    area: ['alt', 'aria-label', 'aria-labelledby'],
    	    // html-has-lang
    	    html: ['lang'],
    	    // iframe-has-title
    	    iframe: ['title'],
    	    img: ['alt'],
    	    object: ['title', 'aria-label', 'aria-labelledby']
    	};
    	const a11y_distracting_elements = new Set([
    	    'blink',
    	    'marquee'
    	]);
    	const a11y_required_content = new Set([
    	    // anchor-has-content
    	    'a',
    	    // heading-has-content
    	    'h1',
    	    'h2',
    	    'h3',
    	    'h4',
    	    'h5',
    	    'h6'
    	]);
    	const invisible_elements = new Set(['meta', 'html', 'script', 'style']);
    	const valid_modifiers = new Set([
    	    'preventDefault',
    	    'stopPropagation',
    	    'capture',
    	    'once',
    	    'passive',
    	    'self'
    	]);
    	const passive_events = new Set([
    	    'wheel',
    	    'touchstart',
    	    'touchmove',
    	    'touchend',
    	    'touchcancel'
    	]);
    	function get_namespace(parent, element, explicit_namespace) {
    	    const parent_element = parent.find_nearest(/^Element/);
    	    if (!parent_element) {
    	        return explicit_namespace || (svg$1.test(element.name)
    	            ? namespaces.svg
    	            : null);
    	    }
    	    if (svg$1.test(element.name.toLowerCase()))
    	        return namespaces.svg;
    	    if (parent_element.name.toLowerCase() === 'foreignobject')
    	        return null;
    	    return parent_element.namespace;
    	}
    	class Element$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.attributes = [];
    	        this.actions = [];
    	        this.bindings = [];
    	        this.classes = [];
    	        this.handlers = [];
    	        this.lets = [];
    	        this.intro = null;
    	        this.outro = null;
    	        this.animation = null;
    	        this.name = info.name;
    	        this.namespace = get_namespace(parent, this, component.namespace);
    	        if (this.name === 'textarea') {
    	            if (info.children.length > 0) {
    	                const value_attribute = info.attributes.find(node => node.name === 'value');
    	                if (value_attribute) {
    	                    component.error(value_attribute, {
    	                        code: `textarea-duplicate-value`,
    	                        message: `A <textarea> can have either a value attribute or (equivalently) child content, but not both`
    	                    });
    	                }
    	                // this is an egregious hack, but it's the easiest way to get <textarea>
    	                // children treated the same way as a value attribute
    	                info.attributes.push({
    	                    type: 'Attribute',
    	                    name: 'value',
    	                    value: info.children
    	                });
    	                info.children = [];
    	            }
    	        }
    	        if (this.name === 'option') {
    	            // Special case — treat these the same way:
    	            //   <option>{foo}</option>
    	            //   <option value={foo}>{foo}</option>
    	            const value_attribute = info.attributes.find(attribute => attribute.name === 'value');
    	            if (!value_attribute) {
    	                info.attributes.push({
    	                    type: 'Attribute',
    	                    name: 'value',
    	                    value: info.children,
    	                    synthetic: true
    	                });
    	            }
    	        }
    	        // Binding relies on Attribute, defer its evaluation
    	        const order = ['Binding']; // everything else is -1
    	        info.attributes.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    	        info.attributes.forEach(node => {
    	            switch (node.type) {
    	                case 'Action':
    	                    this.actions.push(new Action(component, this, scope, node));
    	                    break;
    	                case 'Attribute':
    	                case 'Spread':
    	                    // special case
    	                    if (node.name === 'xmlns')
    	                        this.namespace = node.value[0].data;
    	                    this.attributes.push(new Attribute(component, this, scope, node));
    	                    break;
    	                case 'Binding':
    	                    this.bindings.push(new Binding(component, this, scope, node));
    	                    break;
    	                case 'Class':
    	                    this.classes.push(new Class(component, this, scope, node));
    	                    break;
    	                case 'EventHandler':
    	                    this.handlers.push(new EventHandler(component, this, scope, node));
    	                    break;
    	                case 'Let':
    	                    this.lets.push(new Let(component, this, scope, node));
    	                    break;
    	                case 'Transition':
    	                    {
    	                        const transition = new Transition(component, this, scope, node);
    	                        if (node.intro)
    	                            this.intro = transition;
    	                        if (node.outro)
    	                            this.outro = transition;
    	                        break;
    	                    }
    	                case 'Animation':
    	                    this.animation = new Animation(component, this, scope, node);
    	                    break;
    	                default:
    	                    throw new Error(`Not implemented: ${node.type}`);
    	            }
    	        });
    	        if (this.lets.length > 0) {
    	            this.scope = scope.child();
    	            this.lets.forEach(l => {
    	                const dependencies = new Set([l.name.name]);
    	                l.names.forEach(name => {
    	                    this.scope.add(name, dependencies, this);
    	                });
    	            });
    	        }
    	        else {
    	            this.scope = scope;
    	        }
    	        this.children = map_children(component, this, this.scope, info.children);
    	        this.validate();
    	        component.stylesheet.apply(this);
    	    }
    	    validate() {
    	        if (a11y_distracting_elements.has(this.name)) {
    	            // no-distracting-elements
    	            this.component.warn(this, {
    	                code: `a11y-distracting-elements`,
    	                message: `A11y: Avoid <${this.name}> elements`
    	            });
    	        }
    	        if (this.name === 'figcaption') {
    	            let { parent } = this;
    	            let is_figure_parent = false;
    	            while (parent) {
    	                if (parent.name === 'figure') {
    	                    is_figure_parent = true;
    	                    break;
    	                }
    	                if (parent.type === 'Element') {
    	                    break;
    	                }
    	                parent = parent.parent;
    	            }
    	            if (!is_figure_parent) {
    	                this.component.warn(this, {
    	                    code: `a11y-structure`,
    	                    message: `A11y: <figcaption> must be an immediate child of <figure>`
    	                });
    	            }
    	        }
    	        if (this.name === 'figure') {
    	            const children = this.children.filter(node => {
    	                if (node.type === 'Comment')
    	                    return false;
    	                if (node.type === 'Text')
    	                    return /\S/.test(node.data);
    	                return true;
    	            });
    	            const index = children.findIndex(child => child.name === 'figcaption');
    	            if (index !== -1 && (index !== 0 && index !== children.length - 1)) {
    	                this.component.warn(children[index], {
    	                    code: `a11y-structure`,
    	                    message: `A11y: <figcaption> must be first or last child of <figure>`
    	                });
    	            }
    	        }
    	        this.validate_attributes();
    	        this.validate_bindings();
    	        this.validate_content();
    	        this.validate_event_handlers();
    	    }
    	    validate_attributes() {
    	        const { component } = this;
    	        const attribute_map = new Map();
    	        this.attributes.forEach(attribute => {
    	            if (attribute.is_spread)
    	                return;
    	            const name = attribute.name.toLowerCase();
    	            // aria-props
    	            if (name.startsWith('aria-')) {
    	                if (invisible_elements.has(this.name)) {
    	                    // aria-unsupported-elements
    	                    component.warn(attribute, {
    	                        code: `a11y-aria-attributes`,
    	                        message: `A11y: <${this.name}> should not have aria-* attributes`
    	                    });
    	                }
    	                const type = name.slice(5);
    	                if (!aria_attribute_set.has(type)) {
    	                    const match = fuzzymatch(type, aria_attributes);
    	                    let message = `A11y: Unknown aria attribute 'aria-${type}'`;
    	                    if (match)
    	                        message += ` (did you mean '${match}'?)`;
    	                    component.warn(attribute, {
    	                        code: `a11y-unknown-aria-attribute`,
    	                        message
    	                    });
    	                }
    	                if (name === 'aria-hidden' && /^h[1-6]$/.test(this.name)) {
    	                    component.warn(attribute, {
    	                        code: `a11y-hidden`,
    	                        message: `A11y: <${this.name}> element should not be hidden`
    	                    });
    	                }
    	            }
    	            // aria-role
    	            if (name === 'role') {
    	                if (invisible_elements.has(this.name)) {
    	                    // aria-unsupported-elements
    	                    component.warn(attribute, {
    	                        code: `a11y-misplaced-role`,
    	                        message: `A11y: <${this.name}> should not have role attribute`
    	                    });
    	                }
    	                const value = attribute.get_static_value();
    	                // @ts-ignore
    	                if (value && !aria_role_set.has(value)) {
    	                    // @ts-ignore
    	                    const match = fuzzymatch(value, aria_roles);
    	                    let message = `A11y: Unknown role '${value}'`;
    	                    if (match)
    	                        message += ` (did you mean '${match}'?)`;
    	                    component.warn(attribute, {
    	                        code: `a11y-unknown-role`,
    	                        message
    	                    });
    	                }
    	            }
    	            // no-access-key
    	            if (name === 'accesskey') {
    	                component.warn(attribute, {
    	                    code: `a11y-accesskey`,
    	                    message: `A11y: Avoid using accesskey`
    	                });
    	            }
    	            // no-autofocus
    	            if (name === 'autofocus') {
    	                component.warn(attribute, {
    	                    code: `a11y-autofocus`,
    	                    message: `A11y: Avoid using autofocus`
    	                });
    	            }
    	            // scope
    	            if (name === 'scope' && this.name !== 'th') {
    	                component.warn(attribute, {
    	                    code: `a11y-misplaced-scope`,
    	                    message: `A11y: The scope attribute should only be used with <th> elements`
    	                });
    	            }
    	            // tabindex-no-positive
    	            if (name === 'tabindex') {
    	                const value = attribute.get_static_value();
    	                // @ts-ignore todo is tabindex=true correct case?
    	                if (!isNaN(value) && +value > 0) {
    	                    component.warn(attribute, {
    	                        code: `a11y-positive-tabindex`,
    	                        message: `A11y: avoid tabindex values above zero`
    	                    });
    	                }
    	            }
    	            if (name === 'slot') {
    	                if (!attribute.is_static) {
    	                    component.error(attribute, {
    	                        code: `invalid-slot-attribute`,
    	                        message: `slot attribute cannot have a dynamic value`
    	                    });
    	                }
    	                if (component.slot_outlets.has(name)) {
    	                    component.error(attribute, {
    	                        code: `duplicate-slot-attribute`,
    	                        message: `Duplicate '${name}' slot`
    	                    });
    	                    component.slot_outlets.add(name);
    	                }
    	                let ancestor = this.parent;
    	                do {
    	                    if (ancestor.type === 'InlineComponent')
    	                        break;
    	                    if (ancestor.type === 'Element' && /-/.test(ancestor.name))
    	                        break;
    	                    if (ancestor.type === 'IfBlock' || ancestor.type === 'EachBlock') {
    	                        const type = ancestor.type === 'IfBlock' ? 'if' : 'each';
    	                        const message = `Cannot place slotted elements inside an ${type}-block`;
    	                        component.error(attribute, {
    	                            code: `invalid-slotted-content`,
    	                            message
    	                        });
    	                    }
    	                } while (ancestor = ancestor.parent);
    	                if (!ancestor) {
    	                    component.error(attribute, {
    	                        code: `invalid-slotted-content`,
    	                        message: `Element with a slot='...' attribute must be a descendant of a component or custom element`
    	                    });
    	                }
    	            }
    	            if (name === 'is') {
    	                component.warn(attribute, {
    	                    code: 'avoid-is',
    	                    message: `The 'is' attribute is not supported cross-browser and should be avoided`
    	                });
    	            }
    	            attribute_map.set(attribute.name, attribute);
    	        });
    	        // handle special cases
    	        if (this.name === 'a') {
    	            const attribute = attribute_map.get('href') || attribute_map.get('xlink:href');
    	            if (attribute) {
    	                const value = attribute.get_static_value();
    	                if (value === '' || value === '#') {
    	                    component.warn(attribute, {
    	                        code: `a11y-invalid-attribute`,
    	                        message: `A11y: '${value}' is not a valid ${attribute.name} attribute`
    	                    });
    	                }
    	            }
    	            else {
    	                component.warn(this, {
    	                    code: `a11y-missing-attribute`,
    	                    message: `A11y: <a> element should have an href attribute`
    	                });
    	            }
    	        }
    	        else {
    	            const required_attributes = a11y_required_attributes[this.name];
    	            if (required_attributes) {
    	                const has_attribute = required_attributes.some(name => attribute_map.has(name));
    	                if (!has_attribute) {
    	                    should_have_attribute(this, required_attributes);
    	                }
    	            }
    	            if (this.name === 'input') {
    	                const type = attribute_map.get('type');
    	                if (type && type.get_static_value() === 'image') {
    	                    const required_attributes = ['alt', 'aria-label', 'aria-labelledby'];
    	                    const has_attribute = required_attributes.some(name => attribute_map.has(name));
    	                    if (!has_attribute) {
    	                        should_have_attribute(this, required_attributes, 'input type="image"');
    	                    }
    	                }
    	            }
    	        }
    	    }
    	    validate_bindings() {
    	        const { component } = this;
    	        const check_type_attribute = () => {
    	            const attribute = this.attributes.find((attribute) => attribute.name === 'type');
    	            if (!attribute)
    	                return null;
    	            if (!attribute.is_static) {
    	                component.error(attribute, {
    	                    code: `invalid-type`,
    	                    message: `'type' attribute cannot be dynamic if input uses two-way binding`
    	                });
    	            }
    	            const value = attribute.get_static_value();
    	            if (value === true) {
    	                component.error(attribute, {
    	                    code: `missing-type`,
    	                    message: `'type' attribute must be specified`
    	                });
    	            }
    	            return value;
    	        };
    	        this.bindings.forEach(binding => {
    	            const { name } = binding;
    	            if (name === 'value') {
    	                if (this.name !== 'input' &&
    	                    this.name !== 'textarea' &&
    	                    this.name !== 'select') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'value' is not a valid binding on <${this.name}> elements`
    	                    });
    	                }
    	                if (this.name === 'select') {
    	                    const attribute = this.attributes.find((attribute) => attribute.name === 'multiple');
    	                    if (attribute && !attribute.is_static) {
    	                        component.error(attribute, {
    	                            code: `dynamic-multiple-attribute`,
    	                            message: `'multiple' attribute cannot be dynamic if select uses two-way binding`
    	                        });
    	                    }
    	                }
    	                else {
    	                    check_type_attribute();
    	                }
    	            }
    	            else if (name === 'checked' || name === 'indeterminate') {
    	                if (this.name !== 'input') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'${name}' is not a valid binding on <${this.name}> elements`
    	                    });
    	                }
    	                const type = check_type_attribute();
    	                if (type !== 'checkbox') {
    	                    let message = `'${name}' binding can only be used with <input type="checkbox">`;
    	                    if (type === 'radio')
    	                        message += ` — for <input type="radio">, use 'group' binding`;
    	                    component.error(binding, { code: `invalid-binding`, message });
    	                }
    	            }
    	            else if (name === 'group') {
    	                if (this.name !== 'input') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'group' is not a valid binding on <${this.name}> elements`
    	                    });
    	                }
    	                const type = check_type_attribute();
    	                if (type !== 'checkbox' && type !== 'radio') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'group' binding can only be used with <input type="checkbox"> or <input type="radio">`
    	                    });
    	                }
    	            }
    	            else if (name === 'files') {
    	                if (this.name !== 'input') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'files' is not a valid binding on <${this.name}> elements`
    	                    });
    	                }
    	                const type = check_type_attribute();
    	                if (type !== 'file') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'files' binding can only be used with <input type="file">`
    	                    });
    	                }
    	            }
    	            else if (name === 'open') {
    	                if (this.name !== 'details') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'${name}' binding can only be used with <details>`
    	                    });
    	                }
    	            }
    	            else if (name === 'currentTime' ||
    	                name === 'duration' ||
    	                name === 'paused' ||
    	                name === 'buffered' ||
    	                name === 'seekable' ||
    	                name === 'played' ||
    	                name === 'volume' ||
    	                name === 'playbackRate' ||
    	                name === 'seeking' ||
    	                name === 'ended') {
    	                if (this.name !== 'audio' && this.name !== 'video') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'${name}' binding can only be used with <audio> or <video>`
    	                    });
    	                }
    	            }
    	            else if (name === 'videoHeight' ||
    	                name === 'videoWidth') {
    	                if (this.name !== 'video') {
    	                    component.error(binding, {
    	                        code: `invalid-binding`,
    	                        message: `'${name}' binding can only be used with <video>`
    	                    });
    	                }
    	            }
    	            else if (dimensions.test(name)) {
    	                if (this.name === 'svg' && (name === 'offsetWidth' || name === 'offsetHeight')) {
    	                    component.error(binding, {
    	                        code: 'invalid-binding',
    	                        message: `'${binding.name}' is not a valid binding on <svg>. Use '${name.replace('offset', 'client')}' instead`
    	                    });
    	                }
    	                else if (svg$1.test(this.name)) {
    	                    component.error(binding, {
    	                        code: 'invalid-binding',
    	                        message: `'${binding.name}' is not a valid binding on SVG elements`
    	                    });
    	                }
    	                else if (is_void(this.name)) {
    	                    component.error(binding, {
    	                        code: 'invalid-binding',
    	                        message: `'${binding.name}' is not a valid binding on void elements like <${this.name}>. Use a wrapper element instead`
    	                    });
    	                }
    	            }
    	            else if (name === 'textContent' ||
    	                name === 'innerHTML') {
    	                const contenteditable = this.attributes.find((attribute) => attribute.name === 'contenteditable');
    	                if (!contenteditable) {
    	                    component.error(binding, {
    	                        code: `missing-contenteditable-attribute`,
    	                        message: `'contenteditable' attribute is required for textContent and innerHTML two-way bindings`
    	                    });
    	                }
    	                else if (contenteditable && !contenteditable.is_static) {
    	                    component.error(contenteditable, {
    	                        code: `dynamic-contenteditable-attribute`,
    	                        message: `'contenteditable' attribute cannot be dynamic if element uses two-way binding`
    	                    });
    	                }
    	            }
    	            else if (name !== 'this') {
    	                component.error(binding, {
    	                    code: `invalid-binding`,
    	                    message: `'${binding.name}' is not a valid binding`
    	                });
    	            }
    	        });
    	    }
    	    validate_content() {
    	        if (!a11y_required_content.has(this.name))
    	            return;
    	        if (this.children.length === 0) {
    	            this.component.warn(this, {
    	                code: `a11y-missing-content`,
    	                message: `A11y: <${this.name}> element should have child content`
    	            });
    	        }
    	    }
    	    validate_event_handlers() {
    	        const { component } = this;
    	        this.handlers.forEach(handler => {
    	            if (handler.modifiers.has('passive') && handler.modifiers.has('preventDefault')) {
    	                component.error(handler, {
    	                    code: 'invalid-event-modifier',
    	                    message: `The 'passive' and 'preventDefault' modifiers cannot be used together`
    	                });
    	            }
    	            handler.modifiers.forEach(modifier => {
    	                if (!valid_modifiers.has(modifier)) {
    	                    component.error(handler, {
    	                        code: 'invalid-event-modifier',
    	                        message: `Valid event modifiers are ${list$1(Array.from(valid_modifiers))}`
    	                    });
    	                }
    	                if (modifier === 'passive') {
    	                    if (passive_events.has(handler.name)) {
    	                        if (handler.can_make_passive) {
    	                            component.warn(handler, {
    	                                code: 'redundant-event-modifier',
    	                                message: `Touch event handlers that don't use the 'event' object are passive by default`
    	                            });
    	                        }
    	                    }
    	                    else {
    	                        component.warn(handler, {
    	                            code: 'redundant-event-modifier',
    	                            message: `The passive modifier only works with wheel and touch events`
    	                        });
    	                    }
    	                }
    	                if (component.compile_options.legacy && (modifier === 'once' || modifier === 'passive')) {
    	                    // TODO this could be supported, but it would need a few changes to
    	                    // how event listeners work
    	                    component.error(handler, {
    	                        code: 'invalid-event-modifier',
    	                        message: `The '${modifier}' modifier cannot be used in legacy mode`
    	                    });
    	                }
    	            });
    	            if (passive_events.has(handler.name) && handler.can_make_passive && !handler.modifiers.has('preventDefault')) {
    	                // touch/wheel events should be passive by default
    	                handler.modifiers.add('passive');
    	            }
    	        });
    	    }
    	    is_media_node() {
    	        return this.name === 'audio' || this.name === 'video';
    	    }
    	    add_css_class() {
    	        if (this.attributes.some(attr => attr.is_spread)) {
    	            this.needs_manual_style_scoping = true;
    	            return;
    	        }
    	        const { id } = this.component.stylesheet;
    	        const class_attribute = this.attributes.find(a => a.name === 'class');
    	        if (class_attribute && !class_attribute.is_true) {
    	            if (class_attribute.chunks.length === 1 && class_attribute.chunks[0].type === 'Text') {
    	                class_attribute.chunks[0].data += ` ${id}`;
    	            }
    	            else {
    	                class_attribute.chunks.push(new Text$1(this.component, this, this.scope, {
    	                    type: 'Text',
    	                    data: ` ${id}`,
    	                    synthetic: true
    	                }));
    	            }
    	        }
    	        else {
    	            this.attributes.push(new Attribute(this.component, this, this.scope, {
    	                type: 'Attribute',
    	                name: 'class',
    	                value: [{ type: 'Text', data: id, synthetic: true }]
    	            }));
    	        }
    	    }
    	}
    	function should_have_attribute(node, attributes, name = node.name) {
    	    const article = /^[aeiou]/.test(attributes[0]) ? 'an' : 'a';
    	    const sequence = attributes.length > 1 ?
    	        attributes.slice(0, -1).join(', ') + ` or ${attributes[attributes.length - 1]}` :
    	        attributes[0];
    	    node.component.warn(node, {
    	        code: `a11y-missing-attribute`,
    	        message: `A11y: <${name}> element should have ${article} ${sequence} attribute`
    	    });
    	}

    	class Head$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        if (info.attributes.length) {
    	            component.error(info.attributes[0], {
    	                code: `invalid-attribute`,
    	                message: `<svelte:head> should not have any attributes or directives`
    	            });
    	        }
    	        this.children = map_children(component, parent, scope, info.children.filter(child => {
    	            return (child.type !== 'Text' || /\S/.test(child.data));
    	        }));
    	    }
    	}

    	class IfBlock$1 extends AbstractBlock {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.expression = new Expression(component, this, scope, info.expression);
    	        this.children = map_children(component, this, scope, info.children);
    	        this.else = info.else
    	            ? new ElseBlock(component, this, scope, info.else)
    	            : null;
    	        this.warn_if_empty_block();
    	    }
    	}

    	class InlineComponent$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.attributes = [];
    	        this.bindings = [];
    	        this.handlers = [];
    	        this.lets = [];
    	        if (info.name !== 'svelte:component' && info.name !== 'svelte:self') {
    	            const name = info.name.split('.')[0]; // accommodate namespaces
    	            component.warn_if_undefined(name, info, scope);
    	            component.add_reference(name);
    	        }
    	        this.name = info.name;
    	        this.expression = this.name === 'svelte:component'
    	            ? new Expression(component, this, scope, info.expression)
    	            : null;
    	        info.attributes.forEach(node => {
    	            /* eslint-disable no-fallthrough */
    	            switch (node.type) {
    	                case 'Action':
    	                    component.error(node, {
    	                        code: `invalid-action`,
    	                        message: `Actions can only be applied to DOM elements, not components`
    	                    });
    	                case 'Attribute':
    	                    if (node.name === 'slot') {
    	                        component.error(node, {
    	                            code: `invalid-prop`,
    	                            message: `'slot' is reserved for future use in named slots`
    	                        });
    	                    }
    	                // fallthrough
    	                case 'Spread':
    	                    this.attributes.push(new Attribute(component, this, scope, node));
    	                    break;
    	                case 'Binding':
    	                    this.bindings.push(new Binding(component, this, scope, node));
    	                    break;
    	                case 'Class':
    	                    component.error(node, {
    	                        code: `invalid-class`,
    	                        message: `Classes can only be applied to DOM elements, not components`
    	                    });
    	                case 'EventHandler':
    	                    this.handlers.push(new EventHandler(component, this, scope, node));
    	                    break;
    	                case 'Let':
    	                    this.lets.push(new Let(component, this, scope, node));
    	                    break;
    	                case 'Transition':
    	                    component.error(node, {
    	                        code: `invalid-transition`,
    	                        message: `Transitions can only be applied to DOM elements, not components`
    	                    });
    	                default:
    	                    throw new Error(`Not implemented: ${node.type}`);
    	            }
    	            /* eslint-enable no-fallthrough */
    	        });
    	        if (this.lets.length > 0) {
    	            this.scope = scope.child();
    	            this.lets.forEach(l => {
    	                const dependencies = new Set([l.name.name]);
    	                l.names.forEach(name => {
    	                    this.scope.add(name, dependencies, this);
    	                });
    	            });
    	        }
    	        else {
    	            this.scope = scope;
    	        }
    	        this.handlers.forEach(handler => {
    	            handler.modifiers.forEach(modifier => {
    	                if (modifier !== 'once') {
    	                    component.error(handler, {
    	                        code: 'invalid-event-modifier',
    	                        message: `Event modifiers other than 'once' can only be used on DOM elements`
    	                    });
    	                }
    	            });
    	        });
    	        this.children = map_children(component, this, this.scope, info.children);
    	    }
    	}

    	class Tag$2 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.expression = new Expression(component, this, scope, info.expression);
    	        this.should_cache = (info.expression.type !== 'Identifier' ||
    	            (this.expression.dependencies.size && scope.names.has(info.expression.name)));
    	    }
    	}

    	class MustacheTag extends Tag$2 {
    	}

    	class Options extends Node$1 {
    	}

    	class RawMustacheTag extends Tag$2 {
    	}

    	class DebugTag$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.expressions = info.identifiers.map(node => {
    	            return new Expression(component, parent, scope, node);
    	        });
    	    }
    	}

    	class Slot$1 extends Element$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.values = new Map();
    	        info.attributes.forEach(attr => {
    	            if (attr.type !== 'Attribute') {
    	                component.error(attr, {
    	                    code: `invalid-slot-directive`,
    	                    message: `<slot> cannot have directives`
    	                });
    	            }
    	            if (attr.name === 'name') {
    	                if (attr.value.length !== 1 || attr.value[0].type !== 'Text') {
    	                    component.error(attr, {
    	                        code: `dynamic-slot-name`,
    	                        message: `<slot> name cannot be dynamic`
    	                    });
    	                }
    	                this.slot_name = attr.value[0].data;
    	                if (this.slot_name === 'default') {
    	                    component.error(attr, {
    	                        code: `invalid-slot-name`,
    	                        message: `default is a reserved word — it cannot be used as a slot name`
    	                    });
    	                }
    	            }
    	            this.values.set(attr.name, new Attribute(component, this, scope, attr));
    	        });
    	        if (!this.slot_name)
    	            this.slot_name = 'default';
    	        if (this.slot_name === 'default') {
    	            // if this is the default slot, add our dependencies to any
    	            // other slots (which inherit our slot values) that were
    	            // previously encountered
    	            component.slots.forEach((slot) => {
    	                this.values.forEach((attribute, name) => {
    	                    if (!slot.values.has(name)) {
    	                        slot.values.set(name, attribute);
    	                    }
    	                });
    	            });
    	        }
    	        else if (component.slots.has('default')) {
    	            // otherwise, go the other way — inherit values from
    	            // a previously encountered default slot
    	            const default_slot = component.slots.get('default');
    	            default_slot.values.forEach((attribute, name) => {
    	                if (!this.values.has(name)) {
    	                    this.values.set(name, attribute);
    	                }
    	            });
    	        }
    	        component.slots.set(this.slot_name, this);
    	    }
    	}

    	class Title$1 extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.children = map_children(component, parent, scope, info.children);
    	        if (info.attributes.length > 0) {
    	            component.error(info.attributes[0], {
    	                code: `illegal-attribute`,
    	                message: `<title> cannot have attributes`
    	            });
    	        }
    	        info.children.forEach(child => {
    	            if (child.type !== 'Text' && child.type !== 'MustacheTag') {
    	                component.error(child, {
    	                    code: 'illegal-structure',
    	                    message: `<title> can only contain text and {tags}`
    	                });
    	            }
    	        });
    	        this.should_cache = info.children.length === 1
    	            ? (info.children[0].type !== 'Identifier' ||
    	                scope.names.has(info.children[0].name))
    	            : true;
    	    }
    	}

    	const valid_bindings = [
    	    'innerWidth',
    	    'innerHeight',
    	    'outerWidth',
    	    'outerHeight',
    	    'scrollX',
    	    'scrollY',
    	    'online'
    	];
    	class Window extends Node$1 {
    	    constructor(component, parent, scope, info) {
    	        super(component, parent, scope, info);
    	        this.handlers = [];
    	        this.bindings = [];
    	        this.actions = [];
    	        info.attributes.forEach(node => {
    	            if (node.type === 'EventHandler') {
    	                this.handlers.push(new EventHandler(component, this, scope, node));
    	            }
    	            else if (node.type === 'Binding') {
    	                if (node.expression.type !== 'Identifier') {
    	                    const { parts } = flatten_reference(node.expression);
    	                    // TODO is this constraint necessary?
    	                    component.error(node.expression, {
    	                        code: `invalid-binding`,
    	                        message: `Bindings on <svelte:window> must be to top-level properties, e.g. '${parts[parts.length - 1]}' rather than '${parts.join('.')}'`
    	                    });
    	                }
    	                if (!~valid_bindings.indexOf(node.name)) {
    	                    const match = (node.name === 'width' ? 'innerWidth' :
    	                        node.name === 'height' ? 'innerHeight' :
    	                            fuzzymatch(node.name, valid_bindings));
    	                    const message = `'${node.name}' is not a valid binding on <svelte:window>`;
    	                    if (match) {
    	                        component.error(node, {
    	                            code: `invalid-binding`,
    	                            message: `${message} (did you mean '${match}'?)`
    	                        });
    	                    }
    	                    else {
    	                        component.error(node, {
    	                            code: `invalid-binding`,
    	                            message: `${message} — valid bindings are ${list$1(valid_bindings)}`
    	                        });
    	                    }
    	                }
    	                this.bindings.push(new Binding(component, this, scope, node));
    	            }
    	            else if (node.type === 'Action') {
    	                this.actions.push(new Action(component, this, scope, node));
    	            }
    	        });
    	    }
    	}

    	function get_constructor(type) {
    	    switch (type) {
    	        case 'AwaitBlock': return AwaitBlock$1;
    	        case 'Body': return Body;
    	        case 'Comment': return Comment$2;
    	        case 'EachBlock': return EachBlock$1;
    	        case 'Element': return Element$1;
    	        case 'Head': return Head$1;
    	        case 'IfBlock': return IfBlock$1;
    	        case 'InlineComponent': return InlineComponent$1;
    	        case 'MustacheTag': return MustacheTag;
    	        case 'Options': return Options;
    	        case 'RawMustacheTag': return RawMustacheTag;
    	        case 'DebugTag': return DebugTag$1;
    	        case 'Slot': return Slot$1;
    	        case 'Text': return Text$1;
    	        case 'Title': return Title$1;
    	        case 'Window': return Window;
    	        default: throw new Error(`Not implemented: ${type}`);
    	    }
    	}
    	function map_children(component, parent, scope, children) {
    	    let last = null;
    	    let ignores = [];
    	    return children.map(child => {
    	        const constructor = get_constructor(child.type);
    	        const use_ignores = child.type !== 'Text' && child.type !== 'Comment' && ignores.length;
    	        if (use_ignores)
    	            component.push_ignores(ignores);
    	        const node = new constructor(component, parent, scope, child);
    	        if (use_ignores)
    	            component.pop_ignores(), ignores = [];
    	        if (node.type === 'Comment' && node.ignores.length) {
    	            ignores.push(...node.ignores);
    	        }
    	        if (last)
    	            last.next = node;
    	        node.prev = last;
    	        last = node;
    	        return node;
    	    });
    	}

    	class TemplateScope {
    	    constructor(parent) {
    	        this.owners = new Map();
    	        this.parent = parent;
    	        this.names = new Set(parent ? parent.names : []);
    	        this.dependencies_for_name = new Map(parent ? parent.dependencies_for_name : []);
    	    }
    	    add(name, dependencies, owner) {
    	        this.names.add(name);
    	        this.dependencies_for_name.set(name, dependencies);
    	        this.owners.set(name, owner);
    	        return this;
    	    }
    	    child() {
    	        const child = new TemplateScope(this);
    	        return child;
    	    }
    	    is_top_level(name) {
    	        return !this.parent || !this.names.has(name) && this.parent.is_top_level(name);
    	    }
    	    get_owner(name) {
    	        return this.owners.get(name) || (this.parent && this.parent.get_owner(name));
    	    }
    	    is_let(name) {
    	        const owner = this.get_owner(name);
    	        return owner && (owner.type === 'Element' || owner.type === 'InlineComponent');
    	    }
    	}

    	class Fragment extends Node$1 {
    	    constructor(component, info) {
    	        const scope = new TemplateScope();
    	        super(component, null, scope, info);
    	        this.scope = scope;
    	        this.children = map_children(component, this, scope, info.children);
    	    }
    	}

    	// This file is automatically generated
    	var internal_exports = new Set(["HtmlTag", "SvelteComponent", "SvelteComponentDev", "SvelteElement", "add_attribute", "add_classes", "add_flush_callback", "add_location", "add_render_callback", "add_resize_listener", "add_transform", "afterUpdate", "append", "append_dev", "assign", "attr", "attr_dev", "beforeUpdate", "bind", "binding_callbacks", "blank_object", "bubble", "check_outros", "children", "claim_component", "claim_element", "claim_space", "claim_text", "clear_loops", "component_subscribe", "createEventDispatcher", "create_animation", "create_bidirectional_transition", "create_component", "create_in_transition", "create_out_transition", "create_slot", "create_ssr_component", "current_component", "custom_event", "dataset_dev", "debug", "destroy_block", "destroy_component", "destroy_each", "detach", "detach_after_dev", "detach_before_dev", "detach_between_dev", "detach_dev", "dirty_components", "dispatch_dev", "each", "element", "element_is", "empty", "escape", "escaped", "exclude_internal_props", "fix_and_destroy_block", "fix_and_outro_and_destroy_block", "fix_position", "flush", "getContext", "get_binding_group_value", "get_current_component", "get_slot_changes", "get_slot_context", "get_spread_object", "get_spread_update", "get_store_value", "globals", "group_outros", "handle_promise", "has_prop", "identity", "init", "insert", "insert_dev", "intros", "invalid_attribute_name_character", "is_client", "is_function", "is_promise", "listen", "listen_dev", "loop", "loop_guard", "measure", "missing_component", "mount_component", "noop", "not_equal", "now", "null_to_empty", "object_without_properties", "onDestroy", "onMount", "once", "outro_and_destroy_block", "prevent_default", "prop_dev", "raf", "run", "run_all", "safe_not_equal", "schedule_update", "select_multiple_value", "select_option", "select_options", "select_value", "self", "setContext", "set_attributes", "set_current_component", "set_custom_element_data", "set_data", "set_data_dev", "set_input_type", "set_input_value", "set_now", "set_raf", "set_store_value", "set_style", "set_svg_attributes", "space", "spread", "stop_propagation", "subscribe", "svg_element", "text", "tick", "time_ranges_to_array", "to_number", "toggle_class", "transition_in", "transition_out", "update_keyed_each", "validate_component", "validate_store", "xlink_attr"]);

    	function is_used_as_reference(node, parent) {
    	    if (!isReference(node, parent)) {
    	        return false;
    	    }
    	    if (!parent) {
    	        return true;
    	    }
    	    /* eslint-disable no-fallthrough */
    	    switch (parent.type) {
    	        // disregard the `foo` in `const foo = bar`
    	        case 'VariableDeclarator':
    	            return node !== parent.id;
    	        // disregard the `foo`, `bar` in `function foo(bar){}`
    	        case 'FunctionDeclaration':
    	        // disregard the `foo` in `import { foo } from 'foo'`
    	        case 'ImportSpecifier':
    	        // disregard the `foo` in `import foo from 'foo'`
    	        case 'ImportDefaultSpecifier':
    	        // disregard the `foo` in `import * as foo from 'foo'`
    	        case 'ImportNamespaceSpecifier':
    	        // disregard the `foo` in `export { foo }`
    	        case 'ExportSpecifier':
    	            return false;
    	        default:
    	            return true;
    	    }
    	}

    	function check_graph_for_cycles(edges) {
    	    const graph = edges.reduce((g, edge) => {
    	        const [u, v] = edge;
    	        if (!g.has(u))
    	            g.set(u, []);
    	        if (!g.has(v))
    	            g.set(v, []);
    	        g.get(u).push(v);
    	        return g;
    	    }, new Map());
    	    const visited = new Set();
    	    const on_stack = new Set();
    	    const cycles = [];
    	    function visit(v) {
    	        visited.add(v);
    	        on_stack.add(v);
    	        graph.get(v).forEach(w => {
    	            if (!visited.has(w)) {
    	                visit(w);
    	            }
    	            else if (on_stack.has(w)) {
    	                cycles.push([...on_stack, w]);
    	            }
    	        });
    	        on_stack.delete(v);
    	    }
    	    graph.forEach((_, v) => {
    	        if (!visited.has(v)) {
    	            visit(v);
    	        }
    	    });
    	    return cycles[0];
    	}

    	class Component {
    	    constructor(ast, source, name, compile_options, stats, warnings) {
    	        this.ignore_stack = [];
    	        this.vars = [];
    	        this.var_lookup = new Map();
    	        this.imports = [];
    	        this.hoistable_nodes = new Set();
    	        this.node_for_declaration = new Map();
    	        this.partly_hoisted = [];
    	        this.fully_hoisted = [];
    	        this.reactive_declarations = [];
    	        this.reactive_declaration_nodes = new Set();
    	        this.has_reactive_assignments = false;
    	        this.injected_reactive_declaration_vars = new Set();
    	        this.helpers = new Map();
    	        this.globals = new Map();
    	        this.indirect_dependencies = new Map();
    	        this.aliases = new Map();
    	        this.used_names = new Set();
    	        this.globally_used_names = new Set();
    	        this.slots = new Map();
    	        this.slot_outlets = new Set();
    	        this.name = { type: 'Identifier', name };
    	        this.stats = stats;
    	        this.warnings = warnings;
    	        this.ast = ast;
    	        this.source = source;
    	        this.compile_options = compile_options;
    	        // the instance JS gets mutated, so we park
    	        // a copy here for later. TODO this feels gross
    	        this.original_ast = {
    	            html: ast.html,
    	            css: ast.css,
    	            instance: ast.instance && JSON.parse(JSON.stringify(ast.instance)),
    	            module: ast.module
    	        };
    	        this.file =
    	            compile_options.filename &&
    	                (typeof process !== 'undefined'
    	                    ? compile_options.filename
    	                        .replace(process.cwd(), '')
    	                        .replace(/^[/\\]/, '')
    	                    : compile_options.filename);
    	        this.locate = getLocator(this.source, { offsetLine: 1 });
    	        // styles
    	        this.stylesheet = new Stylesheet(source, ast, compile_options.filename, compile_options.dev);
    	        this.stylesheet.validate(this);
    	        this.component_options = process_component_options(this, this.ast.html.children);
    	        this.namespace =
    	            namespaces[this.component_options.namespace] ||
    	                this.component_options.namespace;
    	        if (compile_options.customElement) {
    	            if (this.component_options.tag === undefined &&
    	                compile_options.tag === undefined) {
    	                const svelteOptions = ast.html.children.find(child => child.name === 'svelte:options') || { start: 0, end: 0 };
    	                this.warn(svelteOptions, {
    	                    code: 'custom-element-no-tag',
    	                    message: `No custom element 'tag' option was specified. To automatically register a custom element, specify a name with a hyphen in it, e.g. <svelte:options tag="my-thing"/>. To hide this warning, use <svelte:options tag={null}/>`,
    	                });
    	            }
    	            this.tag = this.component_options.tag || compile_options.tag;
    	        }
    	        else {
    	            this.tag = this.name.name;
    	        }
    	        this.walk_module_js();
    	        this.walk_instance_js_pre_template();
    	        this.fragment = new Fragment(this, ast.html);
    	        this.name = this.get_unique_name(name);
    	        this.walk_instance_js_post_template();
    	        if (!compile_options.customElement)
    	            this.stylesheet.reify();
    	        this.stylesheet.warn_on_unused_selectors(this);
    	    }
    	    add_var(variable) {
    	        this.vars.push(variable);
    	        this.var_lookup.set(variable.name, variable);
    	    }
    	    add_reference(name) {
    	        const variable = this.var_lookup.get(name);
    	        if (variable) {
    	            variable.referenced = true;
    	        }
    	        else if (name === '$$props') {
    	            this.add_var({
    	                name,
    	                injected: true,
    	                referenced: true,
    	            });
    	        }
    	        else if (name[0] === '$') {
    	            this.add_var({
    	                name,
    	                injected: true,
    	                referenced: true,
    	                mutated: true,
    	                writable: true,
    	            });
    	            const subscribable_name = name.slice(1);
    	            const variable = this.var_lookup.get(subscribable_name);
    	            if (variable)
    	                variable.subscribable = true;
    	        }
    	        else {
    	            this.used_names.add(name);
    	        }
    	    }
    	    alias(name) {
    	        if (!this.aliases.has(name)) {
    	            this.aliases.set(name, this.get_unique_name(name));
    	        }
    	        return this.aliases.get(name);
    	    }
    	    global(name) {
    	        const alias = this.alias(name);
    	        this.globals.set(name, alias);
    	        return alias;
    	    }
    	    generate(result) {
    	        let js = null;
    	        let css = null;
    	        if (result) {
    	            const { compile_options, name } = this;
    	            const { format = 'esm' } = compile_options;
    	            const banner = `${this.file ? `${this.file} ` : ``}generated by Svelte v${'3.16.0'}`;
    	            const program = { type: 'Program', body: result };
    	            walk(program, {
    	                enter: (node, parent, key) => {
    	                    if (node.type === 'Identifier') {
    	                        if (node.name[0] === '@') {
    	                            if (node.name[1] === '_') {
    	                                const alias = this.global(node.name.slice(2));
    	                                node.name = alias.name;
    	                            }
    	                            else {
    	                                let name = node.name.slice(1);
    	                                if (compile_options.dev) {
    	                                    if (internal_exports.has(`${name}_dev`)) {
    	                                        name += '_dev';
    	                                    }
    	                                    else if (internal_exports.has(`${name}Dev`)) {
    	                                        name += 'Dev';
    	                                    }
    	                                }
    	                                const alias = this.alias(name);
    	                                this.helpers.set(name, alias);
    	                                node.name = alias.name;
    	                            }
    	                        }
    	                        else if (node.name[0] !== '#' && !is_valid(node.name)) {
    	                            // this hack allows x`foo.${bar}` where bar could be invalid
    	                            const literal = { type: 'Literal', value: node.name };
    	                            if (parent.type === 'Property' && key === 'key') {
    	                                parent.key = literal;
    	                            }
    	                            else if (parent.type === 'MemberExpression' && key === 'property') {
    	                                parent.property = literal;
    	                                parent.computed = true;
    	                            }
    	                        }
    	                    }
    	                }
    	            });
    	            const referenced_globals = Array.from(this.globals, ([name, alias]) => name !== alias.name && { name, alias }).filter(Boolean);
    	            if (referenced_globals.length) {
    	                this.helpers.set('globals', this.alias('globals'));
    	            }
    	            const imported_helpers = Array.from(this.helpers, ([name, alias]) => ({
    	                name,
    	                alias,
    	            }));
    	            create_module(program, format, name, banner, compile_options.sveltePath, imported_helpers, referenced_globals, this.imports, this.vars
    	                .filter(variable => variable.module && variable.export_name)
    	                .map(variable => ({
    	                name: variable.name,
    	                as: variable.export_name,
    	            })));
    	            css = compile_options.customElement
    	                ? { code: null, map: null }
    	                : this.stylesheet.render(compile_options.cssOutputFilename, true);
    	            js = print(program, {
    	                sourceMapSource: compile_options.filename
    	            });
    	            js.map.sources = [
    	                compile_options.filename ? get_relative_path(compile_options.outputFilename || '', compile_options.filename) : null
    	            ];
    	            js.map.sourcesContent = [
    	                this.source
    	            ];
    	        }
    	        return {
    	            js,
    	            css,
    	            ast: this.original_ast,
    	            warnings: this.warnings,
    	            vars: this.vars
    	                .filter(v => !v.global && !v.internal)
    	                .map(v => ({
    	                name: v.name,
    	                export_name: v.export_name || null,
    	                injected: v.injected || false,
    	                module: v.module || false,
    	                mutated: v.mutated || false,
    	                reassigned: v.reassigned || false,
    	                referenced: v.referenced || false,
    	                writable: v.writable || false,
    	                referenced_from_script: v.referenced_from_script || false,
    	            })),
    	            stats: this.stats.render(),
    	        };
    	    }
    	    get_unique_name(name) {
    	        if (test)
    	            name = `${name}$`;
    	        let alias = name;
    	        for (let i = 1; reserved.has(alias) ||
    	            this.var_lookup.has(alias) ||
    	            this.used_names.has(alias) ||
    	            this.globally_used_names.has(alias); alias = `${name}_${i++}`)
    	            ;
    	        this.used_names.add(alias);
    	        return { type: 'Identifier', name: alias };
    	    }
    	    get_unique_name_maker() {
    	        const local_used_names = new Set();
    	        function add(name) {
    	            local_used_names.add(name);
    	        }
    	        reserved.forEach(add);
    	        internal_exports.forEach(add);
    	        this.var_lookup.forEach((_value, key) => add(key));
    	        return (name) => {
    	            if (test)
    	                name = `${name}$`;
    	            let alias = name;
    	            for (let i = 1; this.used_names.has(alias) || local_used_names.has(alias); alias = `${name}_${i++}`)
    	                ;
    	            local_used_names.add(alias);
    	            this.globally_used_names.add(alias);
    	            return {
    	                type: 'Identifier',
    	                name: alias
    	            };
    	        };
    	    }
    	    error(pos, e) {
    	        error$1(e.message, {
    	            name: 'ValidationError',
    	            code: e.code,
    	            source: this.source,
    	            start: pos.start,
    	            end: pos.end,
    	            filename: this.compile_options.filename,
    	        });
    	    }
    	    warn(pos, warning) {
    	        if (this.ignores && this.ignores.has(warning.code)) {
    	            return;
    	        }
    	        const start = this.locate(pos.start);
    	        const end = this.locate(pos.end);
    	        const frame = get_code_frame(this.source, start.line - 1, start.column);
    	        this.warnings.push({
    	            code: warning.code,
    	            message: warning.message,
    	            frame,
    	            start,
    	            end,
    	            pos: pos.start,
    	            filename: this.compile_options.filename,
    	            toString: () => `${warning.message} (${start.line}:${start.column})\n${frame}`,
    	        });
    	    }
    	    extract_imports(node) {
    	        this.imports.push(node);
    	    }
    	    extract_exports(node) {
    	        if (node.type === 'ExportDefaultDeclaration') {
    	            this.error(node, {
    	                code: `default-export`,
    	                message: `A component cannot have a default export`,
    	            });
    	        }
    	        if (node.type === 'ExportNamedDeclaration') {
    	            if (node.source) {
    	                this.error(node, {
    	                    code: `not-implemented`,
    	                    message: `A component currently cannot have an export ... from`,
    	                });
    	            }
    	            if (node.declaration) {
    	                if (node.declaration.type === 'VariableDeclaration') {
    	                    node.declaration.declarations.forEach(declarator => {
    	                        extract_names(declarator.id).forEach(name => {
    	                            const variable = this.var_lookup.get(name);
    	                            variable.export_name = name;
    	                            if (variable.writable && !(variable.referenced || variable.referenced_from_script)) {
    	                                this.warn(declarator, {
    	                                    code: `unused-export-let`,
    	                                    message: `${this.name.name} has unused export property '${name}'. If it is for external reference only, please consider using \`export const '${name}'\``
    	                                });
    	                            }
    	                        });
    	                    });
    	                }
    	                else {
    	                    const { name } = node.declaration.id;
    	                    const variable = this.var_lookup.get(name);
    	                    variable.export_name = name;
    	                }
    	                return node.declaration;
    	            }
    	            else {
    	                node.specifiers.forEach(specifier => {
    	                    const variable = this.var_lookup.get(specifier.local.name);
    	                    if (variable) {
    	                        variable.export_name = specifier.exported.name;
    	                        if (variable.writable && !(variable.referenced || variable.referenced_from_script)) {
    	                            this.warn(specifier, {
    	                                code: `unused-export-let`,
    	                                message: `${this.name.name} has unused export property '${specifier.exported.name}'. If it is for external reference only, please consider using \`export const '${specifier.exported.name}'\``
    	                            });
    	                        }
    	                    }
    	                });
    	                return null;
    	            }
    	        }
    	    }
    	    extract_javascript(script) {
    	        if (!script)
    	            return null;
    	        return script.content.body.filter(node => {
    	            if (!node)
    	                return false;
    	            if (this.hoistable_nodes.has(node))
    	                return false;
    	            if (this.reactive_declaration_nodes.has(node))
    	                return false;
    	            if (node.type === 'ImportDeclaration')
    	                return false;
    	            if (node.type === 'ExportDeclaration' && node.specifiers.length > 0)
    	                return false;
    	            return true;
    	        });
    	    }
    	    walk_module_js() {
    	        const component = this;
    	        const script = this.ast.module;
    	        if (!script)
    	            return;
    	        walk(script.content, {
    	            enter(node) {
    	                if (node.type === 'LabeledStatement' && node.label.name === '$') {
    	                    component.warn(node, {
    	                        code: 'module-script-reactive-declaration',
    	                        message: '$: has no effect in a module script',
    	                    });
    	                }
    	            },
    	        });
    	        const { scope, globals } = create_scopes(script.content);
    	        this.module_scope = scope;
    	        scope.declarations.forEach((node, name) => {
    	            if (name[0] === '$') {
    	                this.error(node, {
    	                    code: 'illegal-declaration',
    	                    message: `The $ prefix is reserved, and cannot be used for variable and import names`,
    	                });
    	            }
    	            const writable = node.type === 'VariableDeclaration' && (node.kind === 'var' || node.kind === 'let');
    	            this.add_var({
    	                name,
    	                module: true,
    	                hoistable: true,
    	                writable
    	            });
    	        });
    	        globals.forEach((node, name) => {
    	            if (name[0] === '$') {
    	                this.error(node, {
    	                    code: 'illegal-subscription',
    	                    message: `Cannot reference store value inside <script context="module">`,
    	                });
    	            }
    	            else {
    	                this.add_var({
    	                    name,
    	                    global: true,
    	                    hoistable: true
    	                });
    	            }
    	        });
    	        const { body } = script.content;
    	        let i = body.length;
    	        while (--i >= 0) {
    	            const node = body[i];
    	            if (node.type === 'ImportDeclaration') {
    	                this.extract_imports(node);
    	                body.splice(i, 1);
    	            }
    	            if (/^Export/.test(node.type)) {
    	                const replacement = this.extract_exports(node);
    	                if (replacement) {
    	                    body[i] = replacement;
    	                }
    	                else {
    	                    body.splice(i, 1);
    	                }
    	            }
    	        }
    	    }
    	    walk_instance_js_pre_template() {
    	        const script = this.ast.instance;
    	        if (!script)
    	            return;
    	        // inject vars for reactive declarations
    	        script.content.body.forEach(node => {
    	            if (node.type !== 'LabeledStatement')
    	                return;
    	            if (node.body.type !== 'ExpressionStatement')
    	                return;
    	            const { expression } = node.body;
    	            if (expression.type !== 'AssignmentExpression')
    	                return;
    	            extract_names(expression.left).forEach(name => {
    	                if (!this.var_lookup.has(name) && name[0] !== '$') {
    	                    this.injected_reactive_declaration_vars.add(name);
    	                }
    	            });
    	        });
    	        const { scope: instance_scope, map, globals } = create_scopes(script.content);
    	        this.instance_scope = instance_scope;
    	        this.instance_scope_map = map;
    	        instance_scope.declarations.forEach((node, name) => {
    	            if (name[0] === '$') {
    	                this.error(node, {
    	                    code: 'illegal-declaration',
    	                    message: `The $ prefix is reserved, and cannot be used for variable and import names`,
    	                });
    	            }
    	            const writable = node.type === 'VariableDeclaration' && (node.kind === 'var' || node.kind === 'let');
    	            this.add_var({
    	                name,
    	                initialised: instance_scope.initialised_declarations.has(name),
    	                hoistable: /^Import/.test(node.type),
    	                writable
    	            });
    	            this.node_for_declaration.set(name, node);
    	        });
    	        globals.forEach((node, name) => {
    	            if (this.var_lookup.has(name))
    	                return;
    	            if (this.injected_reactive_declaration_vars.has(name)) {
    	                this.add_var({
    	                    name,
    	                    injected: true,
    	                    writable: true,
    	                    reassigned: true,
    	                    initialised: true,
    	                });
    	            }
    	            else if (name === '$$props') {
    	                this.add_var({
    	                    name,
    	                    injected: true,
    	                });
    	            }
    	            else if (name[0] === '$') {
    	                if (name === '$' || name[1] === '$') {
    	                    this.error(node, {
    	                        code: 'illegal-global',
    	                        message: `${name} is an illegal variable name`
    	                    });
    	                }
    	                this.add_var({
    	                    name,
    	                    injected: true,
    	                    mutated: true,
    	                    writable: true,
    	                });
    	                this.add_reference(name.slice(1));
    	                const variable = this.var_lookup.get(name.slice(1));
    	                if (variable) {
    	                    variable.subscribable = true;
    	                    variable.referenced_from_script = true;
    	                }
    	            }
    	            else {
    	                this.add_var({
    	                    name,
    	                    global: true,
    	                    hoistable: true
    	                });
    	            }
    	        });
    	        this.track_references_and_mutations();
    	    }
    	    walk_instance_js_post_template() {
    	        const script = this.ast.instance;
    	        if (!script)
    	            return;
    	        this.post_template_walk();
    	        this.hoist_instance_declarations();
    	        this.extract_reactive_declarations();
    	    }
    	    post_template_walk() {
    	        const script = this.ast.instance;
    	        if (!script)
    	            return;
    	        const component = this;
    	        const { content } = script;
    	        const { instance_scope, instance_scope_map: map } = this;
    	        let scope = instance_scope;
    	        const to_remove = [];
    	        const remove = (parent, prop, index) => {
    	            to_remove.unshift([parent, prop, index]);
    	        };
    	        const to_insert = new Map();
    	        walk(content, {
    	            enter(node, parent, prop, index) {
    	                if (map.has(node)) {
    	                    scope = map.get(node);
    	                }
    	                if (node.type === 'ImportDeclaration') {
    	                    component.extract_imports(node);
    	                    // TODO: to use actual remove
    	                    remove(parent, prop, index);
    	                    return this.skip();
    	                }
    	                if (/^Export/.test(node.type)) {
    	                    const replacement = component.extract_exports(node);
    	                    if (replacement) {
    	                        this.replace(replacement);
    	                    }
    	                    else {
    	                        // TODO: to use actual remove
    	                        remove(parent, prop, index);
    	                    }
    	                    return this.skip();
    	                }
    	                component.warn_on_undefined_store_value_references(node, parent, scope);
    	                if (component.compile_options.dev && component.compile_options.loopGuardTimeout > 0) {
    	                    const to_insert_for_loop_protect = component.loop_protect(node, prop, index, component.compile_options.loopGuardTimeout);
    	                    if (to_insert_for_loop_protect) {
    	                        if (!Array.isArray(parent[prop])) {
    	                            parent[prop] = {
    	                                type: 'BlockStatement',
    	                                body: [to_insert_for_loop_protect.node, node],
    	                            };
    	                        }
    	                        else {
    	                            // can't insert directly, will screw up the index in the for-loop of estree-walker
    	                            if (!to_insert.has(parent)) {
    	                                to_insert.set(parent, []);
    	                            }
    	                            to_insert.get(parent).push(to_insert_for_loop_protect);
    	                        }
    	                    }
    	                }
    	            },
    	            leave(node) {
    	                if (map.has(node)) {
    	                    scope = scope.parent;
    	                }
    	                if (to_insert.has(node)) {
    	                    const nodes_to_insert = to_insert.get(node);
    	                    for (const { index, prop, node: node_to_insert } of nodes_to_insert.reverse()) {
    	                        node[prop].splice(index, 0, node_to_insert);
    	                    }
    	                    to_insert.delete(node);
    	                }
    	            },
    	        });
    	        for (const [parent, prop, index] of to_remove) {
    	            if (parent) {
    	                if (index !== null) {
    	                    parent[prop].splice(index, 1);
    	                }
    	                else {
    	                    delete parent[prop];
    	                }
    	            }
    	        }
    	    }
    	    track_references_and_mutations() {
    	        const script = this.ast.instance;
    	        if (!script)
    	            return;
    	        const component = this;
    	        const { content } = script;
    	        const { instance_scope, instance_scope_map: map } = this;
    	        let scope = instance_scope;
    	        walk(content, {
    	            enter(node, parent) {
    	                if (map.has(node)) {
    	                    scope = map.get(node);
    	                }
    	                if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
    	                    const assignee = node.type === 'AssignmentExpression' ? node.left : node.argument;
    	                    const names = extract_names(assignee);
    	                    const deep = assignee.type === 'MemberExpression';
    	                    names.forEach(name => {
    	                        if (scope.find_owner(name) === instance_scope) {
    	                            const variable = component.var_lookup.get(name);
    	                            variable[deep ? 'mutated' : 'reassigned'] = true;
    	                        }
    	                    });
    	                }
    	                if (is_used_as_reference(node, parent)) {
    	                    const object = get_object(node);
    	                    if (scope.find_owner(object.name) === instance_scope) {
    	                        const variable = component.var_lookup.get(object.name);
    	                        variable.referenced_from_script = true;
    	                    }
    	                }
    	            },
    	            leave(node) {
    	                if (map.has(node)) {
    	                    scope = scope.parent;
    	                }
    	            },
    	        });
    	    }
    	    warn_on_undefined_store_value_references(node, parent, scope) {
    	        if (node.type === 'LabeledStatement' &&
    	            node.label.name === '$' &&
    	            parent.type !== 'Program') {
    	            this.warn(node, {
    	                code: 'non-top-level-reactive-declaration',
    	                message: '$: has no effect outside of the top-level',
    	            });
    	        }
    	        if (isReference(node, parent)) {
    	            const object = get_object(node);
    	            const { name } = object;
    	            if (name[0] === '$' && !scope.has(name)) {
    	                this.warn_if_undefined(name, object, null);
    	            }
    	        }
    	    }
    	    loop_protect(node, prop, index, timeout) {
    	        if (node.type === 'WhileStatement' ||
    	            node.type === 'ForStatement' ||
    	            node.type === 'DoWhileStatement') {
    	            const guard = this.get_unique_name('guard');
    	            this.add_var({
    	                name: guard.name,
    	                internal: true,
    	            });
    	            const before = b `const ${guard} = @loop_guard(${timeout})`;
    	            const inside = b `${guard}();`;
    	            // wrap expression statement with BlockStatement
    	            if (node.body.type !== 'BlockStatement') {
    	                node.body = {
    	                    type: 'BlockStatement',
    	                    body: [node.body],
    	                };
    	            }
    	            node.body.body.push(inside[0]);
    	            return { index, prop, node: before[0] };
    	        }
    	        return null;
    	    }
    	    rewrite_props(get_insert) {
    	        if (!this.ast.instance)
    	            return;
    	        const component = this;
    	        const { instance_scope, instance_scope_map: map } = this;
    	        let scope = instance_scope;
    	        walk(this.ast.instance.content, {
    	            enter(node, parent, key, index) {
    	                if (/Function/.test(node.type)) {
    	                    return this.skip();
    	                }
    	                if (map.has(node)) {
    	                    scope = map.get(node);
    	                }
    	                if (node.type === 'VariableDeclaration') {
    	                    if (node.kind === 'var' || scope === instance_scope) {
    	                        node.declarations.forEach(declarator => {
    	                            if (declarator.id.type !== 'Identifier') {
    	                                const inserts = [];
    	                                extract_names(declarator.id).forEach(name => {
    	                                    const variable = component.var_lookup.get(name);
    	                                    if (variable.export_name) {
    	                                        // TODO is this still true post-#3539?
    	                                        component.error(declarator, {
    	                                            code: 'destructured-prop',
    	                                            message: `Cannot declare props in destructured declaration`,
    	                                        });
    	                                    }
    	                                    if (variable.subscribable) {
    	                                        inserts.push(get_insert(variable));
    	                                    }
    	                                });
    	                                if (inserts.length) {
    	                                    parent[key].splice(index + 1, 0, ...inserts);
    	                                }
    	                                return;
    	                            }
    	                            const { name } = declarator.id;
    	                            const variable = component.var_lookup.get(name);
    	                            if (variable.export_name && variable.writable) {
    	                                const insert = variable.subscribable
    	                                    ? get_insert(variable)
    	                                    : null;
    	                                parent[key].splice(index + 1, 0, insert);
    	                                declarator.id = {
    	                                    type: 'ObjectPattern',
    	                                    properties: [{
    	                                            type: 'Property',
    	                                            method: false,
    	                                            shorthand: false,
    	                                            computed: false,
    	                                            kind: 'init',
    	                                            key: { type: 'Identifier', name: variable.export_name },
    	                                            value: declarator.init
    	                                                ? {
    	                                                    type: 'AssignmentPattern',
    	                                                    left: declarator.id,
    	                                                    right: declarator.init
    	                                                }
    	                                                : declarator.id
    	                                        }]
    	                                };
    	                                declarator.init = x `$$props`;
    	                            }
    	                            else if (variable.subscribable) {
    	                                const insert = get_insert(variable);
    	                                parent[key].splice(index + 1, 0, ...insert);
    	                            }
    	                        });
    	                    }
    	                }
    	            },
    	            leave(node, parent, _key, index) {
    	                if (map.has(node)) {
    	                    scope = scope.parent;
    	                }
    	                if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    	                    parent.body[index] = node.declaration;
    	                }
    	            },
    	        });
    	    }
    	    hoist_instance_declarations() {
    	        // we can safely hoist variable declarations that are
    	        // initialised to literals, and functions that don't
    	        // reference instance variables other than other
    	        // hoistable functions. TODO others?
    	        const { hoistable_nodes, var_lookup, injected_reactive_declaration_vars, } = this;
    	        const top_level_function_declarations = new Map();
    	        const { body } = this.ast.instance.content;
    	        for (let i = 0; i < body.length; i += 1) {
    	            const node = body[i];
    	            if (node.type === 'VariableDeclaration') {
    	                const all_hoistable = node.declarations.every(d => {
    	                    if (!d.init)
    	                        return false;
    	                    if (d.init.type !== 'Literal')
    	                        return false;
    	                    // everything except const values can be changed by e.g. svelte devtools
    	                    // which means we can't hoist it
    	                    if (node.kind !== 'const' && this.compile_options.dev)
    	                        return false;
    	                    const { name } = d.id;
    	                    const v = this.var_lookup.get(name);
    	                    if (v.reassigned)
    	                        return false;
    	                    if (v.export_name)
    	                        return false;
    	                    if (this.var_lookup.get(name).reassigned)
    	                        return false;
    	                    if (this.vars.find(variable => variable.name === name && variable.module))
    	                        return false;
    	                    return true;
    	                });
    	                if (all_hoistable) {
    	                    node.declarations.forEach(d => {
    	                        const variable = this.var_lookup.get(d.id.name);
    	                        variable.hoistable = true;
    	                    });
    	                    hoistable_nodes.add(node);
    	                    body.splice(i--, 1);
    	                    this.fully_hoisted.push(node);
    	                }
    	            }
    	            if (node.type === 'ExportNamedDeclaration' &&
    	                node.declaration &&
    	                node.declaration.type === 'FunctionDeclaration') {
    	                top_level_function_declarations.set(node.declaration.id.name, node);
    	            }
    	            if (node.type === 'FunctionDeclaration') {
    	                top_level_function_declarations.set(node.id.name, node);
    	            }
    	        }
    	        const checked = new Set();
    	        const walking = new Set();
    	        const is_hoistable = fn_declaration => {
    	            if (fn_declaration.type === 'ExportNamedDeclaration') {
    	                fn_declaration = fn_declaration.declaration;
    	            }
    	            const instance_scope = this.instance_scope;
    	            let scope = this.instance_scope;
    	            const map = this.instance_scope_map;
    	            let hoistable = true;
    	            // handle cycles
    	            walking.add(fn_declaration);
    	            walk(fn_declaration, {
    	                enter(node, parent) {
    	                    if (!hoistable)
    	                        return this.skip();
    	                    if (map.has(node)) {
    	                        scope = map.get(node);
    	                    }
    	                    if (isReference(node, parent)) {
    	                        const { name } = flatten_reference(node);
    	                        const owner = scope.find_owner(name);
    	                        if (injected_reactive_declaration_vars.has(name)) {
    	                            hoistable = false;
    	                        }
    	                        else if (name[0] === '$' && !owner) {
    	                            hoistable = false;
    	                        }
    	                        else if (owner === instance_scope) {
    	                            const variable = var_lookup.get(name);
    	                            if (variable.reassigned || variable.mutated)
    	                                hoistable = false;
    	                            if (name === fn_declaration.id.name)
    	                                return;
    	                            if (variable.hoistable)
    	                                return;
    	                            if (top_level_function_declarations.has(name)) {
    	                                const other_declaration = top_level_function_declarations.get(name);
    	                                if (walking.has(other_declaration)) {
    	                                    hoistable = false;
    	                                }
    	                                else if (other_declaration.type === 'ExportNamedDeclaration' &&
    	                                    walking.has(other_declaration.declaration)) {
    	                                    hoistable = false;
    	                                }
    	                                else if (!is_hoistable(other_declaration)) {
    	                                    hoistable = false;
    	                                }
    	                            }
    	                            else {
    	                                hoistable = false;
    	                            }
    	                        }
    	                        this.skip();
    	                    }
    	                },
    	                leave(node) {
    	                    if (map.has(node)) {
    	                        scope = scope.parent;
    	                    }
    	                },
    	            });
    	            checked.add(fn_declaration);
    	            walking.delete(fn_declaration);
    	            return hoistable;
    	        };
    	        for (const [name, node] of top_level_function_declarations) {
    	            if (is_hoistable(node)) {
    	                const variable = this.var_lookup.get(name);
    	                variable.hoistable = true;
    	                hoistable_nodes.add(node);
    	                const i = body.indexOf(node);
    	                body.splice(i, 1);
    	                this.fully_hoisted.push(node);
    	            }
    	        }
    	    }
    	    extract_reactive_declarations() {
    	        const component = this;
    	        const unsorted_reactive_declarations = [];
    	        this.ast.instance.content.body.forEach(node => {
    	            if (node.type === 'LabeledStatement' && node.label.name === '$') {
    	                this.reactive_declaration_nodes.add(node);
    	                const assignees = new Set();
    	                const assignee_nodes = new Set();
    	                const dependencies = new Set();
    	                let scope = this.instance_scope;
    	                const map = this.instance_scope_map;
    	                walk(node.body, {
    	                    enter(node, parent) {
    	                        if (map.has(node)) {
    	                            scope = map.get(node);
    	                        }
    	                        if (node.type === 'AssignmentExpression') {
    	                            const left = get_object(node.left);
    	                            extract_identifiers(left).forEach(node => {
    	                                assignee_nodes.add(node);
    	                                assignees.add(node.name);
    	                            });
    	                            if (node.operator !== '=') {
    	                                dependencies.add(left.name);
    	                            }
    	                        }
    	                        else if (node.type === 'UpdateExpression') {
    	                            const identifier = get_object(node.argument);
    	                            assignees.add(identifier.name);
    	                        }
    	                        else if (isReference(node, parent)) {
    	                            const identifier = get_object(node);
    	                            if (!assignee_nodes.has(identifier)) {
    	                                const { name } = identifier;
    	                                const owner = scope.find_owner(name);
    	                                const variable = component.var_lookup.get(name);
    	                                if (variable)
    	                                    variable.is_reactive_dependency = true;
    	                                const is_writable_or_mutated = variable && (variable.writable || variable.mutated);
    	                                if ((!owner || owner === component.instance_scope) &&
    	                                    (name[0] === '$' || is_writable_or_mutated)) {
    	                                    dependencies.add(name);
    	                                }
    	                            }
    	                            this.skip();
    	                        }
    	                    },
    	                    leave(node) {
    	                        if (map.has(node)) {
    	                            scope = scope.parent;
    	                        }
    	                    },
    	                });
    	                const { expression } = node.body;
    	                const declaration = expression && expression.left;
    	                unsorted_reactive_declarations.push({
    	                    assignees,
    	                    dependencies,
    	                    node,
    	                    declaration,
    	                });
    	            }
    	        });
    	        const lookup = new Map();
    	        let seen;
    	        unsorted_reactive_declarations.forEach(declaration => {
    	            declaration.assignees.forEach(name => {
    	                if (!lookup.has(name)) {
    	                    lookup.set(name, []);
    	                }
    	                // TODO warn or error if a name is assigned to in
    	                // multiple reactive declarations?
    	                lookup.get(name).push(declaration);
    	            });
    	        });
    	        const cycle = check_graph_for_cycles(unsorted_reactive_declarations.reduce((acc, declaration) => {
    	            declaration.assignees.forEach(v => {
    	                declaration.dependencies.forEach(w => {
    	                    if (!declaration.assignees.has(w)) {
    	                        acc.push([v, w]);
    	                    }
    	                });
    	            });
    	            return acc;
    	        }, []));
    	        if (cycle && cycle.length) {
    	            const declarationList = lookup.get(cycle[0]);
    	            const declaration = declarationList[0];
    	            this.error(declaration.node, {
    	                code: 'cyclical-reactive-declaration',
    	                message: `Cyclical dependency detected: ${cycle.join(' → ')}`
    	            });
    	        }
    	        const add_declaration = declaration => {
    	            if (this.reactive_declarations.indexOf(declaration) !== -1) {
    	                return;
    	            }
    	            seen.add(declaration);
    	            declaration.dependencies.forEach(name => {
    	                if (declaration.assignees.has(name))
    	                    return;
    	                const earlier_declarations = lookup.get(name);
    	                if (earlier_declarations)
    	                    earlier_declarations.forEach(declaration => {
    	                        add_declaration(declaration);
    	                    });
    	            });
    	            this.reactive_declarations.push(declaration);
    	        };
    	        unsorted_reactive_declarations.forEach(declaration => {
    	            seen = new Set();
    	            add_declaration(declaration);
    	        });
    	    }
    	    warn_if_undefined(name, node, template_scope) {
    	        if (name[0] === '$') {
    	            if (name === '$' || name[1] === '$' && name !== '$$props') {
    	                this.error(node, {
    	                    code: 'illegal-global',
    	                    message: `${name} is an illegal variable name`
    	                });
    	            }
    	            this.has_reactive_assignments = true; // TODO does this belong here?
    	            if (name === '$$props')
    	                return;
    	            name = name.slice(1);
    	        }
    	        if (this.var_lookup.has(name) && !this.var_lookup.get(name).global)
    	            return;
    	        if (template_scope && template_scope.names.has(name))
    	            return;
    	        if (globals.has(name))
    	            return;
    	        let message = `'${name}' is not defined`;
    	        if (!this.ast.instance)
    	            message += `. Consider adding a <script> block with 'export let ${name}' to declare a prop`;
    	        this.warn(node, {
    	            code: 'missing-declaration',
    	            message,
    	        });
    	    }
    	    push_ignores(ignores) {
    	        this.ignores = new Set(this.ignores || []);
    	        add_to_set(this.ignores, ignores);
    	        this.ignore_stack.push(this.ignores);
    	    }
    	    pop_ignores() {
    	        this.ignore_stack.pop();
    	        this.ignores = this.ignore_stack[this.ignore_stack.length - 1];
    	    }
    	}
    	function process_component_options(component, nodes) {
    	    const component_options = {
    	        immutable: component.compile_options.immutable || false,
    	        accessors: 'accessors' in component.compile_options
    	            ? component.compile_options.accessors
    	            : !!component.compile_options.customElement,
    	        preserveWhitespace: !!component.compile_options.preserveWhitespace,
    	    };
    	    const node = nodes.find(node => node.name === 'svelte:options');
    	    function get_value(attribute, code, message) {
    	        const { value } = attribute;
    	        const chunk = value[0];
    	        if (!chunk)
    	            return true;
    	        if (value.length > 1) {
    	            component.error(attribute, { code, message });
    	        }
    	        if (chunk.type === 'Text')
    	            return chunk.data;
    	        if (chunk.expression.type !== 'Literal') {
    	            component.error(attribute, { code, message });
    	        }
    	        return chunk.expression.value;
    	    }
    	    if (node) {
    	        node.attributes.forEach(attribute => {
    	            if (attribute.type === 'Attribute') {
    	                const { name } = attribute;
    	                switch (name) {
    	                    case 'tag': {
    	                        const code = 'invalid-tag-attribute';
    	                        const message = `'tag' must be a string literal`;
    	                        const tag = get_value(attribute, code, message);
    	                        if (typeof tag !== 'string' && tag !== null)
    	                            component.error(attribute, { code, message });
    	                        if (tag && !/^[a-zA-Z][a-zA-Z0-9]*-[a-zA-Z0-9-]+$/.test(tag)) {
    	                            component.error(attribute, {
    	                                code: `invalid-tag-property`,
    	                                message: `tag name must be two or more words joined by the '-' character`,
    	                            });
    	                        }
    	                        if (tag && !component.compile_options.customElement) {
    	                            component.warn(attribute, {
    	                                code: 'missing-custom-element-compile-options',
    	                                message: `The 'tag' option is used when generating a custom element. Did you forget the 'customElement: true' compile option?`
    	                            });
    	                        }
    	                        component_options.tag = tag;
    	                        break;
    	                    }
    	                    case 'namespace': {
    	                        const code = 'invalid-namespace-attribute';
    	                        const message = `The 'namespace' attribute must be a string literal representing a valid namespace`;
    	                        const ns = get_value(attribute, code, message);
    	                        if (typeof ns !== 'string')
    	                            component.error(attribute, { code, message });
    	                        if (valid_namespaces.indexOf(ns) === -1) {
    	                            const match = fuzzymatch(ns, valid_namespaces);
    	                            if (match) {
    	                                component.error(attribute, {
    	                                    code: `invalid-namespace-property`,
    	                                    message: `Invalid namespace '${ns}' (did you mean '${match}'?)`,
    	                                });
    	                            }
    	                            else {
    	                                component.error(attribute, {
    	                                    code: `invalid-namespace-property`,
    	                                    message: `Invalid namespace '${ns}'`,
    	                                });
    	                            }
    	                        }
    	                        component_options.namespace = ns;
    	                        break;
    	                    }
    	                    case 'accessors':
    	                    case 'immutable':
    	                    case 'preserveWhitespace': {
    	                        const code = `invalid-${name}-value`;
    	                        const message = `${name} attribute must be true or false`;
    	                        const value = get_value(attribute, code, message);
    	                        if (typeof value !== 'boolean')
    	                            component.error(attribute, { code, message });
    	                        component_options[name] = value;
    	                        break;
    	                    }
    	                    default:
    	                        component.error(attribute, {
    	                            code: `invalid-options-attribute`,
    	                            message: `<svelte:options> unknown attribute`,
    	                        });
    	                }
    	            }
    	            else {
    	                component.error(attribute, {
    	                    code: `invalid-options-attribute`,
    	                    message: `<svelte:options> can only have static 'tag', 'namespace', 'accessors', 'immutable' and 'preserveWhitespace' attributes`,
    	                });
    	            }
    	        });
    	    }
    	    return component_options;
    	}
    	function get_relative_path(from, to) {
    	    const from_parts = from.split(/[/\\]/);
    	    const to_parts = to.split(/[/\\]/);
    	    from_parts.pop(); // get dirname
    	    while (from_parts[0] === to_parts[0]) {
    	        from_parts.shift();
    	        to_parts.shift();
    	    }
    	    if (from_parts.length) {
    	        let i = from_parts.length;
    	        while (i--)
    	            from_parts[i] = '..';
    	    }
    	    return from_parts.concat(to_parts).join('/');
    	}

    	function get_name_from_filename(filename) {
    	    if (!filename)
    	        return null;
    	    const parts = filename.split(/[/\\]/).map(encodeURI);
    	    if (parts.length > 1) {
    	        const index_match = parts[parts.length - 1].match(/^index(\.\w+)/);
    	        if (index_match) {
    	            parts.pop();
    	            parts[parts.length - 1] += index_match[1];
    	        }
    	    }
    	    const base = parts.pop()
    	        .replace(/%/g, 'u')
    	        .replace(/\.[^.]+$/, "")
    	        .replace(/[^a-zA-Z_$0-9]+/g, '_')
    	        .replace(/^_/, '')
    	        .replace(/_$/, '')
    	        .replace(/^(\d)/, '_$1');
    	    if (!base) {
    	        throw new Error(`Could not derive component name from file ${filename}`);
    	    }
    	    return base[0].toUpperCase() + base.slice(1);
    	}

    	const valid_options = [
    	    'format',
    	    'name',
    	    'filename',
    	    'generate',
    	    'outputFilename',
    	    'cssOutputFilename',
    	    'sveltePath',
    	    'dev',
    	    'accessors',
    	    'immutable',
    	    'hydratable',
    	    'legacy',
    	    'customElement',
    	    'tag',
    	    'css',
    	    'loopGuardTimeout',
    	    'preserveComments',
    	    'preserveWhitespace'
    	];
    	function validate_options(options, warnings) {
    	    const { name, filename, loopGuardTimeout, dev } = options;
    	    Object.keys(options).forEach(key => {
    	        if (valid_options.indexOf(key) === -1) {
    	            const match = fuzzymatch(key, valid_options);
    	            let message = `Unrecognized option '${key}'`;
    	            if (match)
    	                message += ` (did you mean '${match}'?)`;
    	            throw new Error(message);
    	        }
    	    });
    	    if (name && !/^[a-zA-Z_$][a-zA-Z_$0-9]*$/.test(name)) {
    	        throw new Error(`options.name must be a valid identifier (got '${name}')`);
    	    }
    	    if (name && /^[a-z]/.test(name)) {
    	        const message = `options.name should be capitalised`;
    	        warnings.push({
    	            code: `options-lowercase-name`,
    	            message,
    	            filename,
    	            toString: () => message,
    	        });
    	    }
    	    if (loopGuardTimeout && !dev) {
    	        const message = 'options.loopGuardTimeout is for options.dev = true only';
    	        warnings.push({
    	            code: `options-loop-guard-timeout`,
    	            message,
    	            filename,
    	            toString: () => message,
    	        });
    	    }
    	}
    	function compile(source, options = {}) {
    	    options = assign({ generate: 'dom', dev: false }, options);
    	    const stats = new Stats();
    	    const warnings = [];
    	    validate_options(options, warnings);
    	    stats.start('parse');
    	    const ast = parse$2(source, options);
    	    stats.stop('parse');
    	    stats.start('create component');
    	    const component = new Component(ast, source, options.name || get_name_from_filename(options.filename) || 'Component', options, stats, warnings);
    	    stats.stop('create component');
    	    const js = options.generate === false
    	        ? null
    	        : options.generate === 'ssr'
    	            ? ssr(component, options)
    	            : dom(component, options);
    	    return component.generate(js);
    	}

    	function parse_attributes(str) {
    	    const attrs = {};
    	    str.split(/\s+/).filter(Boolean).forEach(attr => {
    	        const p = attr.indexOf('=');
    	        if (p === -1) {
    	            attrs[attr] = true;
    	        }
    	        else {
    	            attrs[attr.slice(0, p)] = `'"`.includes(attr[p + 1]) ?
    	                attr.slice(p + 2, -1) :
    	                attr.slice(p + 1);
    	        }
    	    });
    	    return attrs;
    	}
    	async function replace_async(str, re, func) {
    	    const replacements = [];
    	    str.replace(re, (...args) => {
    	        replacements.push(func(...args).then(res => ({
    	            offset: args[args.length - 2],
    	            length: args[0].length,
    	            replacement: res,
    	        })));
    	        return '';
    	    });
    	    let out = '';
    	    let last_end = 0;
    	    for (const { offset, length, replacement } of await Promise.all(replacements)) {
    	        out += str.slice(last_end, offset) + replacement;
    	        last_end = offset + length;
    	    }
    	    out += str.slice(last_end);
    	    return out;
    	}
    	async function preprocess(source, preprocessor, options) {
    	    // @ts-ignore todo: doublecheck
    	    const filename = (options && options.filename) || preprocessor.filename; // legacy
    	    const dependencies = [];
    	    const preprocessors = Array.isArray(preprocessor) ? preprocessor : [preprocessor];
    	    const markup = preprocessors.map(p => p.markup).filter(Boolean);
    	    const script = preprocessors.map(p => p.script).filter(Boolean);
    	    const style = preprocessors.map(p => p.style).filter(Boolean);
    	    for (const fn of markup) {
    	        const processed = await fn({
    	            content: source,
    	            filename
    	        });
    	        if (processed && processed.dependencies)
    	            dependencies.push(...processed.dependencies);
    	        source = processed ? processed.code : source;
    	    }
    	    for (const fn of script) {
    	        source = await replace_async(source, /<!--[^]*?-->|<script(\s[^]*?)?>([^]*?)<\/script>/gi, async (match, attributes = '', content) => {
    	            if (!attributes && !content) {
    	                return match;
    	            }
    	            attributes = attributes || '';
    	            const processed = await fn({
    	                content,
    	                attributes: parse_attributes(attributes),
    	                filename
    	            });
    	            if (processed && processed.dependencies)
    	                dependencies.push(...processed.dependencies);
    	            return processed ? `<script${attributes}>${processed.code}</script>` : match;
    	        });
    	    }
    	    for (const fn of style) {
    	        source = await replace_async(source, /<!--[^]*?-->|<style(\s[^]*?)?>([^]*?)<\/style>/gi, async (match, attributes = '', content) => {
    	            if (!attributes && !content) {
    	                return match;
    	            }
    	            const processed = await fn({
    	                content,
    	                attributes: parse_attributes(attributes),
    	                filename
    	            });
    	            if (processed && processed.dependencies)
    	                dependencies.push(...processed.dependencies);
    	            return processed ? `<style${attributes}>${processed.code}</style>` : match;
    	        });
    	    }
    	    return {
    	        // TODO return separated output, in future version where svelte.compile supports it:
    	        // style: { code: styleCode, map: styleMap },
    	        // script { code: scriptCode, map: scriptMap },
    	        // markup { code: markupCode, map: markupMap },
    	        code: source,
    	        dependencies: [...new Set(dependencies)],
    	        toString() {
    	            return source;
    	        }
    	    };
    	}

    	const VERSION = '3.16.0';

    	exports.VERSION = VERSION;
    	exports.compile = compile;
    	exports.parse = parse$2;
    	exports.preprocess = preprocess;
    	exports.walk = walk;

    	Object.defineProperty(exports, '__esModule', { value: true });

    }));
    //# sourceMappingURL=compiler.js.map
    });

    var svelte = unwrapExports(compiler);

    const app = new App({
        target: document.body,
        props: {
            version: svelte.version
        }
    });

    return app;

}());
