
/**
 * Headers.js
 *
 * Headers class offers convenient helpers
 */

const invalidTokenRegex = /[^`\-\w!#$%&'*+.|~]/;
const invalidHeaderCharRegex = /[^\t\u0020-\u007E\u0080-\u00FF]/;

function validateName(name) {
	name = `${name}`;
	if (invalidTokenRegex.test(name) || name === '') {
		throw new TypeError(`${name} is not a legal HTTP header name`);
	}
}

function validateValue(value) {
	value = `${value}`;
	if (invalidHeaderCharRegex.test(value)) {
		throw new TypeError(`${value} is not a legal HTTP header value`);
	}
}

/**
 * Find the key in the map object given a header name.
 *
 * Returns undefined if not found.
 *
 * @param   String  name  Header name
 * @return  String|Undefined
 */
function find(map, name) {
	name = name.toLowerCase();
	for (const key in map) {
		if (key.toLowerCase() === name) {
			return key;
		}
	}

	return undefined;
}

const MAP = Symbol('map');
export default class Headers {
	/**
	 * Headers class
	 *
	 * @param   Object  headers  Response headers
	 * @return  Void
	 */
	constructor(init = undefined) {
		this[MAP] = Object.create(null);

		if (init instanceof Headers) {
			const rawHeaders = init.raw();
			const headerNames = Object.keys(rawHeaders);

			for (const headerName of headerNames) {
				for (const value of rawHeaders[headerName]) {
					this.append(headerName, value);
				}
			}

			return;
		}

		// We don't worry about converting prop to ByteString here as append()
		// will handle it.
		// eslint-disable-next-line no-eq-null, eqeqeq
		if (init == null) {
			// No op
		} else if (typeof init === 'object') {
			const method = init[Symbol.iterator];
			// eslint-disable-next-line no-eq-null, eqeqeq
			if (method != null) {
				if (typeof method !== 'function') {
					throw new TypeError('Header pairs must be iterable');
				}

				// Sequence<sequence<ByteString>>
				// Note: per spec we have to first exhaust the lists then process them
				const pairs = [];
				for (const pair of init) {
					if (typeof pair !== 'object' || typeof pair[Symbol.iterator] !== 'function') {
						throw new TypeError('Each header pair must be iterable');
					}

					pairs.push([...pair]);
				}

				for (const pair of pairs) {
					if (pair.length !== 2) {
						throw new TypeError('Each header pair must be a name/value tuple');
					}

					this.append(pair[0], pair[1]);
				}
			} else {
				// Record<ByteString, ByteString>
				for (const key of Object.keys(init)) {
					const value = init[key];
					this.append(key, value);
				}
			}
		} else {
			throw new TypeError('Provided initializer must be an object');
		}
	}

	/**
	 * Return combined header value given name
	 *
	 * @param   String  name  Header name
	 * @return  Mixed
	 */
	get(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key === undefined) {
			return null;
		}

		let value = this[MAP][key].join(', ');
		if (name.toLowerCase() === 'content-encoding') {
			value = value.toLowerCase();
		}

		return value;
	}

	/**
	 * Iterate over all headers
	 *
	 * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
	 * @param   Boolean   thisArg   `this` context for callback function
	 * @return  Void
	 */
	forEach(callback, thisArg = undefined) {
		let pairs = getHeaders(this);
		let i = 0;
		while (i < pairs.length) {
			const [name, value] = pairs[i];
			callback.call(thisArg, value, name, this);
			pairs = getHeaders(this);
			i++;
		}
	}

	/**
	 * Overwrite header values given name
	 *
	 * @param   String  name   Header name
	 * @param   String  value  Header value
	 * @return  Void
	 */
	set(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		this[MAP][key !== undefined ? key : name] = [value];
	}

	/**
	 * Append a value onto existing header
	 *
	 * @param   String  name   Header name
	 * @param   String  value  Header value
	 * @return  Void
	 */
	append(name, value) {
		name = `${name}`;
		value = `${value}`;
		validateName(name);
		validateValue(value);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			this[MAP][key].push(value);
		} else {
			this[MAP][name] = [value];
		}
	}

	/**
	 * Check for header name existence
	 *
	 * @param   String   name  Header name
	 * @return  Boolean
	 */
	has(name) {
		name = `${name}`;
		validateName(name);
		return find(this[MAP], name) !== undefined;
	}

	/**
	 * Delete all header values given name
	 *
	 * @param   String  name  Header name
	 * @return  Void
	 */
	delete(name) {
		name = `${name}`;
		validateName(name);
		const key = find(this[MAP], name);
		if (key !== undefined) {
			delete this[MAP][key];
		}
	}

	/**
	 * Return raw headers (non-spec api)
	 *
	 * @return  Object
	 */
	raw() {
		return this[MAP];
	}

	/**
	 * Get an iterator on keys.
	 *
	 * @return  Iterator
	 */
	keys() {
		return createHeadersIterator(this, 'key');
	}

	/**
	 * Get an iterator on values.
	 *
	 * @return  Iterator
	 */
	values() {
		return createHeadersIterator(this, 'value');
	}

	/**
	 * Get an iterator on entries.
	 *
	 * This is the default iterator of the Headers object.
	 *
	 * @return  Iterator
	 */
	[Symbol.iterator]() {
		return createHeadersIterator(this, 'key+value');
	}
}
Headers.prototype.entries = Headers.prototype[Symbol.iterator];

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
	value: 'Headers',
	writable: false,
	enumerable: false,
	configurable: true
});

Object.defineProperties(Headers.prototype, {
	get: {enumerable: true},
	forEach: {enumerable: true},
	set: {enumerable: true},
	append: {enumerable: true},
	has: {enumerable: true},
	delete: {enumerable: true},
	keys: {enumerable: true},
	values: {enumerable: true},
	entries: {enumerable: true}
});

function getHeaders(headers, kind = 'key+value') {
	const keys = Object.keys(headers[MAP]).sort();
	return keys.map(
		kind === 'key' ?
			k => k.toLowerCase() :
			(kind === 'value' ?
				k => headers[MAP][k].join(', ') :
				k => [k.toLowerCase(), headers[MAP][k].join(', ')])
	);
}

const INTERNAL = Symbol('internal');

function createHeadersIterator(target, kind) {
	const iterator = Object.create(HeadersIteratorPrototype);
	iterator[INTERNAL] = {
		target,
		kind,
		index: 0
	};
	return iterator;
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
	next() {
		// istanbul ignore if
		if (!this ||
			Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
			throw new TypeError('Value of `this` is not a HeadersIterator');
		}

		const {
			target,
			kind,
			index
		} = this[INTERNAL];
		const values = getHeaders(target, kind);
		const length_ = values.length;
		if (index >= length_) {
			return {
				value: undefined,
				done: true
			};
		}

		this[INTERNAL].index = index + 1;

		return {
			value: values[index],
			done: false
		};
	}
}, Object.getPrototypeOf(
	Object.getPrototypeOf([][Symbol.iterator]())
));

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
	value: 'HeadersIterator',
	writable: false,
	enumerable: false,
	configurable: true
});

/**
 * Export the Headers object in a form that Node.js can consume.
 *
 * @param   Headers  headers
 * @return  Object
 */
export function exportNodeCompatibleHeaders(headers) {
	const object = {__proto__: null, ...headers[MAP]};

	// Http.request() only supports string as Host header. This hack makes
	// specifying custom Host header possible.
	const hostHeaderKey = find(headers[MAP], 'Host');
	if (hostHeaderKey !== undefined) {
		object[hostHeaderKey] = object[hostHeaderKey][0];
	}

	return object;
}

/**
 * Create a Headers object from an object of headers, ignoring those that do
 * not conform to HTTP grammar productions.
 *
 * @param   Object  obj  Object of headers
 * @return  Headers
 */
export function createHeadersLenient(object) {
	const headers = new Headers();
	for (const name of Object.keys(object)) {
		if (invalidTokenRegex.test(name)) {
			continue;
		}

		if (Array.isArray(object[name])) {
			for (const value of object[name]) {
				if (invalidHeaderCharRegex.test(value)) {
					continue;
				}

				if (headers[MAP][name] === undefined) {
					headers[MAP][name] = [value];
				} else {
					headers[MAP][name].push(value);
				}
			}
		} else if (!invalidHeaderCharRegex.test(object[name])) {
			headers[MAP][name] = [object[name]];
		}
	}

	return headers;
}
