import restana from "restana"
import accepts from 'accepts'
import cookie from 'cookie'
import send from 'send'
import path from "path";
var mime = send.mime;

var charsetRegExp = /;\s*charset\s*=/;

export default function <P extends restana.Protocol>(
    req: restana.Request<P>,
    res: restana.Response<P>,
    next: (error?: unknown) => void
) {
    req.get = function (param: string) {
        return req.headers[param]
    }
    res.get = function (param: string) {
        return res.getHeader(param)
    }
    res.set = function (field, val) {
        if (arguments.length === 2) {
            var value = Array.isArray(val)
                ? val.map(String)
                : String(val);

            // add charset to content-type
            if (field.toLowerCase() === 'content-type') {
                if (Array.isArray(value)) {
                    throw new TypeError('Content-Type cannot be set to an Array');
                }
                if (!charsetRegExp.test(value)) {
                    var charset = mime.charsets.lookup(value.split(';')[0]);
                    if (charset) value += '; charset=' + charset.toLowerCase();
                }
            }

            this.setHeader(field, value);
        } else {
            for (var key in field) {
                this.set(key, field[key]);
            }
        }
        return this;
    };
    res.redirect = function (location: string) {
        res.statusCode = 302
        res.setHeader('Location', location)
        res.end()
    }
    res.clearCookie = function clearCookie(name, options) {
        var opts = { expires: new Date(1), path: '/', ...options };

        return this.cookie(name, '', opts);
    };
    req.accepts = function () {
        var accept = accepts(req);
        return accept.types.apply(accept, arguments);
    };
    res.append = function append(field, val) {
        var prev = this.get(field);
        var value = val;

        if (prev) {
            // concat the new and prev vals
            value = Array.isArray(prev) ? prev.concat(val)
                : Array.isArray(val) ? [prev].concat(val)
                    : [prev, val]
        }

        return this.set(field, value);
    };
    res.cookie = function (name, value, options) {
        var opts = { ...options };
        var secret = this.req.secret;
        var signed = opts.signed;

        if (signed && !secret) {
            throw new Error('cookieParser("secret") required for signed cookies');
        }

        var val = typeof value === 'object'
            ? 'j:' + JSON.stringify(value)
            : String(value);

        if (signed) {
            val = 's:' + sign(val, secret);
        }

        if ('maxAge' in opts) {
            opts.expires = new Date(Date.now() + opts.maxAge);
            opts.maxAge /= 1000;
        }

        if (opts.path == null) {
            opts.path = '/';
        }

        this.append('Set-Cookie', cookie.serialize(name, String(val), opts));

        return this;
    };
    next()
}