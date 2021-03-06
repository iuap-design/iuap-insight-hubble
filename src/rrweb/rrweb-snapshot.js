var rrwebSnapshot = (function (exports) {
    'use strict';
  
    (function (NodeType) {
        NodeType[NodeType["Document"] = 0] = "Document";
        NodeType[NodeType["DocumentType"] = 1] = "DocumentType";
        NodeType[NodeType["Element"] = 2] = "Element";
        NodeType[NodeType["Text"] = 3] = "Text";
        NodeType[NodeType["CDATA"] = 4] = "CDATA";
        NodeType[NodeType["Comment"] = 5] = "Comment";
    })(exports.NodeType || (exports.NodeType = {}));
  
    var _id = 1;
    var tagNameRegex = RegExp('[^a-z1-6-_]');
    function genId() {
        return _id++;
    }
    function getValidTagName(tagName) {
        var processedTagName = tagName.toLowerCase().trim();
        if (tagNameRegex.test(processedTagName)) {
            return 'div';
        }
        return processedTagName;
    }
    function getCssRulesString(s) {
        try {
            var rules = s.rules || s.cssRules;
            return rules
                ? Array.from(rules).reduce(function (prev, cur) { return prev + getCssRuleString(cur); }, '')
                : null;
        }
        catch (error) {
            return null;
        }
    }
    function getCssRuleString(rule) {
        return isCSSImportRule(rule)
            ? getCssRulesString(rule.styleSheet) || ''
            : rule.cssText;
    }
    function isCSSImportRule(rule) {
        return 'styleSheet' in rule;
    }
    function extractOrigin(url) {
        var origin;
        if (url.indexOf('//') > -1) {
            origin = url.split('/').slice(0, 3).join('/');
        }
        else {
            origin = url.split('/')[0];
        }
        origin = origin.split('?')[0];
        return origin;
    }
    var URL_IN_CSS_REF = /url\((?:'([^']*)'|"([^"]*)"|([^)]*))\)/gm;
    var RELATIVE_PATH = /^(?!www\.|(?:http|ftp)s?:\/\/|[A-Za-z]:\\|\/\/).*/;
    var DATA_URI = /^(data:)([\w\/\+\-]+);(charset=[\w-]+|base64).*,(.*)/i;
    function absoluteToStylesheet(cssText, href) {
        return (cssText || '').replace(URL_IN_CSS_REF, function (origin, path1, path2, path3) {
            var filePath = path1 || path2 || path3;
            if (!filePath) {
                return origin;
            }
            if (!RELATIVE_PATH.test(filePath)) {
                return "url('" + filePath + "')";
            }
            if (DATA_URI.test(filePath)) {
                return "url(" + filePath + ")";
            }
            if (filePath[0] === '/') {
                return "url('" + (extractOrigin(href) + filePath) + "')";
            }
            var stack = href.split('/');
            var parts = filePath.split('/');
            stack.pop();
            for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
                var part = parts_1[_i];
                if (part === '.') {
                    continue;
                }
                else if (part === '..') {
                    stack.pop();
                }
                else {
                    stack.push(part);
                }
            }
            return "url('" + stack.join('/') + "')";
        });
    }
    function getAbsoluteSrcsetString(doc, attributeValue) {
        if (attributeValue.trim() === '') {
            return attributeValue;
        }
        var srcsetValues = attributeValue.split(',');
        var resultingSrcsetString = srcsetValues
            .map(function (srcItem) {
            var trimmedSrcItem = srcItem.trimLeft().trimRight();
            var urlAndSize = trimmedSrcItem.split(' ');
            if (urlAndSize.length === 2) {
                var absUrl = absoluteToDoc(doc, urlAndSize[0]);
                return absUrl + " " + urlAndSize[1];
            }
            else if (urlAndSize.length === 1) {
                var absUrl = absoluteToDoc(doc, urlAndSize[0]);
                return "" + absUrl;
            }
            return '';
        })
            .join(', ');
        return resultingSrcsetString;
    }
    function absoluteToDoc(doc, attributeValue) {
        if (!attributeValue || attributeValue.trim() === '') {
            return attributeValue;
        }
        var a = doc.createElement('a');
        a.href = attributeValue;
        return a.href;
    }
    function isSVGElement(el) {
        return el.tagName === 'svg' || el instanceof SVGElement;
    }
    function transformAttribute(doc, name, value) {
        if (name === 'src' || (name === 'href' && value)) {
            return absoluteToDoc(doc, value);
        }
        else if (name === 'srcset' && value) {
            return getAbsoluteSrcsetString(doc, value);
        }
        else if (name === 'style' && value) {
            return absoluteToStylesheet(value, location.href);
        }
        else {
            return value;
        }
    }
    function serializeNode(n, doc, blockClass, inlineStylesheet, maskInputOptions, recordCanvas) {
        if (maskInputOptions === void 0) { maskInputOptions = {}; }
        switch (n.nodeType) {
            case n.DOCUMENT_NODE:
                return {
                    type: exports.NodeType.Document,
                    childNodes: [],
                };
            case n.DOCUMENT_TYPE_NODE:
                return {
                    type: exports.NodeType.DocumentType,
                    name: n.name,
                    publicId: n.publicId,
                    systemId: n.systemId,
                };
            case n.ELEMENT_NODE:
                var needBlock_1 = false;
                if (typeof blockClass === 'string') {
                    needBlock_1 = n.classList.contains(blockClass);
                }
                else {
                    n.classList.forEach(function (className) {
                        if (blockClass.test(className)) {
                            needBlock_1 = true;
                        }
                    });
                }
                var tagName = getValidTagName(n.tagName);
                var attributes_1 = {};
                for (var _i = 0, _a = Array.from(n.attributes); _i < _a.length; _i++) {
                    var _b = _a[_i], name = _b.name, value = _b.value;
                    attributes_1[name] = transformAttribute(doc, name, value);
                }
                if (tagName === 'link' && inlineStylesheet) {
                    var stylesheet = Array.from(doc.styleSheets).find(function (s) {
                        return s.href === n.href;
                    });
                    var cssText = getCssRulesString(stylesheet);
                    if (cssText) {
                        delete attributes_1.rel;
                        delete attributes_1.href;
                        attributes_1._cssText = absoluteToStylesheet(cssText, stylesheet.href);
                    }
                }
                if (tagName === 'style' &&
                    n.sheet &&
                    !(n.innerText ||
                        n.textContent ||
                        '').trim().length) {
                    var cssText = getCssRulesString(n.sheet);
                    if (cssText) {
                        attributes_1._cssText = absoluteToStylesheet(cssText, location.href);
                    }
                }
                if (tagName === 'input' ||
                    tagName === 'textarea' ||
                    tagName === 'select') {
                    var value = n.value;
                    if (attributes_1.type !== 'radio' &&
                        attributes_1.type !== 'checkbox' &&
                        attributes_1.type !== 'submit' &&
                        attributes_1.type !== 'button' &&
                        value) {
                        attributes_1.value =
                            maskInputOptions[attributes_1.type] ||
                                maskInputOptions[tagName]
                                ? '*'.repeat(value.length)
                                : value;
                    }
                    else if (n.checked) {
                        attributes_1.checked = n.checked;
                    }
                }
                if (tagName === 'option') {
                    var selectValue = n.parentElement;
                    if (attributes_1.value === selectValue.value) {
                        attributes_1.selected = n.selected;
                    }
                }
                if (tagName === 'canvas' && recordCanvas) {
                    attributes_1.rr_dataURL = n.toDataURL();
                }
                if (tagName === 'audio' || tagName === 'video') {
                    attributes_1.rr_mediaState = n.paused
                        ? 'paused'
                        : 'played';
                }
                if (n.scrollLeft) {
                    attributes_1.rr_scrollLeft = n.scrollLeft;
                }
                if (n.scrollTop) {
                    attributes_1.rr_scrollTop = n.scrollTop;
                }
                if (needBlock_1) {
                    var _c = n.getBoundingClientRect(), width = _c.width, height = _c.height;
                    attributes_1.rr_width = width + "px";
                    attributes_1.rr_height = height + "px";
                }
                return {
                    type: exports.NodeType.Element,
                    tagName: tagName,
                    attributes: attributes_1,
                    childNodes: [],
                    isSVG: isSVGElement(n) || undefined,
                    needBlock: needBlock_1,
                };
            case n.TEXT_NODE:
                var parentTagName = n.parentNode && n.parentNode.tagName;
                var textContent = n.textContent;
                var isStyle = parentTagName === 'STYLE' ? true : undefined;
                if (isStyle && textContent) {
                    textContent = absoluteToStylesheet(textContent, location.href);
                }
                if (parentTagName === 'SCRIPT') {
                    textContent = 'SCRIPT_PLACEHOLDER';
                }
                return {
                    type: exports.NodeType.Text,
                    textContent: textContent || '',
                    isStyle: isStyle,
                };
            case n.CDATA_SECTION_NODE:
                return {
                    type: exports.NodeType.CDATA,
                    textContent: '',
                };
            case n.COMMENT_NODE:
                return {
                    type: exports.NodeType.Comment,
                    textContent: n.textContent || '',
                };
            default:
                return false;
        }
    }
    function serializeNodeWithId(n, doc, map, blockClass, skipChild, inlineStylesheet, maskInputOptions, recordCanvas) {
        if (skipChild === void 0) { skipChild = false; }
        if (inlineStylesheet === void 0) { inlineStylesheet = true; }
        var _serializedNode = serializeNode(n, doc, blockClass, inlineStylesheet, maskInputOptions, recordCanvas || false);
        if (!_serializedNode) {
            console.warn(n, 'not serialized');
            return null;
        }
        var id;
        if ('__sn' in n) {
            id = n.__sn.id;
        }
        else {
            id = genId();
        }
        var serializedNode = Object.assign(_serializedNode, { id: id });
        n.__sn = serializedNode;
        map[id] = n;
        var recordChild = !skipChild;
        if (serializedNode.type === exports.NodeType.Element) {
            recordChild = recordChild && !serializedNode.needBlock;
            delete serializedNode.needBlock;
        }
        if ((serializedNode.type === exports.NodeType.Document ||
            serializedNode.type === exports.NodeType.Element) &&
            recordChild) {
            for (var _i = 0, _a = Array.from(n.childNodes); _i < _a.length; _i++) {
                var childN = _a[_i];
                var serializedChildNode = serializeNodeWithId(childN, doc, map, blockClass, skipChild, inlineStylesheet, maskInputOptions, recordCanvas);
                if (serializedChildNode) {
                    serializedNode.childNodes.push(serializedChildNode);
                }
            }
        }
        return serializedNode;
    }
    function snapshot(n, blockClass, inlineStylesheet, maskAllInputsOrOptions, recordCanvas) {
        if (blockClass === void 0) { blockClass = 'rr-block'; }
        if (inlineStylesheet === void 0) { inlineStylesheet = true; }
        var idNodeMap = {};
        var maskInputOptions = maskAllInputsOrOptions === true
            ? {
                color: true,
                date: true,
                'datetime-local': true,
                email: true,
                month: true,
                number: true,
                range: true,
                search: true,
                tel: true,
                text: true,
                time: true,
                url: true,
                week: true,
                textarea: true,
                select: true,
            }
            : maskAllInputsOrOptions === false
                ? {}
                : maskAllInputsOrOptions;
        return [
            serializeNodeWithId(n, n, idNodeMap, blockClass, false, inlineStylesheet, maskInputOptions, recordCanvas),
            idNodeMap,
        ];
    }
    function visitSnapshot(node, onVisit) {
        function walk(current) {
            onVisit(current);
            if (current.type === exports.NodeType.Document ||
                current.type === exports.NodeType.Element) {
                current.childNodes.forEach(walk);
            }
        }
        walk(node);
    }
  
    var commentre = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;
    function parse(css, options) {
        if (options === void 0) { options = {}; }
        var lineno = 1;
        var column = 1;
        function updatePosition(str) {
            var lines = str.match(/\n/g);
            if (lines) {
                lineno += lines.length;
            }
            var i = str.lastIndexOf('\n');
            column = i === -1 ? column + str.length : str.length - i;
        }
        function position() {
            var start = { line: lineno, column: column };
            return function (node) {
                node.position = new Position(start);
                whitespace();
                return node;
            };
        }
        var Position = (function () {
            function Position(start) {
                this.start = start;
                this.end = { line: lineno, column: column };
                this.source = options.source;
            }
            return Position;
        }());
        Position.prototype.content = css;
        var errorsList = [];
        function error(msg) {
            var err = new Error(options.source + ':' + lineno + ':' + column + ': ' + msg);
            err.reason = msg;
            err.filename = options.source;
            err.line = lineno;
            err.column = column;
            err.source = css;
            if (options.silent) {
                errorsList.push(err);
            }
            else {
                throw err;
            }
        }
        function stylesheet() {
            var rulesList = rules();
            return {
                type: 'stylesheet',
                stylesheet: {
                    source: options.source,
                    rules: rulesList,
                    parsingErrors: errorsList,
                },
            };
        }
        function open() {
            return match(/^{\s*/);
        }
        function close() {
            return match(/^}/);
        }
        function rules() {
            var node;
            var rules = [];
            whitespace();
            comments(rules);
            while (css.length && css.charAt(0) !== '}' && (node = atrule() || rule())) {
                if (node !== false) {
                    rules.push(node);
                    comments(rules);
                }
            }
            return rules;
        }
        function match(re) {
            var m = re.exec(css);
            if (!m) {
                return;
            }
            var str = m[0];
            updatePosition(str);
            css = css.slice(str.length);
            return m;
        }
        function whitespace() {
            match(/^\s*/);
        }
        function comments(rules) {
            if (rules === void 0) { rules = []; }
            var c;
            while ((c = comment())) {
                if (c !== false) {
                    rules.push(c);
                }
                c = comment();
            }
            return rules;
        }
        function comment() {
            var pos = position();
            if ('/' !== css.charAt(0) || '*' !== css.charAt(1)) {
                return;
            }
            var i = 2;
            while ('' !== css.charAt(i) &&
                ('*' !== css.charAt(i) || '/' !== css.charAt(i + 1))) {
                ++i;
            }
            i += 2;
            if ('' === css.charAt(i - 1)) {
                return error('End of comment missing');
            }
            var str = css.slice(2, i - 2);
            column += 2;
            updatePosition(str);
            css = css.slice(i);
            column += 2;
            return pos({
                type: 'comment',
                comment: str,
            });
        }
        function selector() {
            var m = match(/^([^{]+)/);
            if (!m) {
                return;
            }
            return trim(m[0])
                .replace(/\/\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*\/+/g, '')
                .replace(/"(?:\\"|[^"])*"|'(?:\\'|[^'])*'/g, function (m) {
                return m.replace(/,/g, '\u200C');
            })
                .split(/\s*(?![^(]*\)),\s*/)
                .map(function (s) {
                return s.replace(/\u200C/g, ',');
            });
        }
        function declaration() {
            var pos = position();
            var propMatch = match(/^(\*?[-#\/\*\\\w]+(\[[0-9a-z_-]+\])?)\s*/);
            if (!propMatch) {
                return;
            }
            var prop = trim(propMatch[0]);
            if (!match(/^:\s*/)) {
                return error("property missing ':'");
            }
            var val = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^\)]*?\)|[^};])+)/);
            var ret = pos({
                type: 'declaration',
                property: prop.replace(commentre, ''),
                value: val ? trim(val[0]).replace(commentre, '') : '',
            });
            match(/^[;\s]*/);
            return ret;
        }
        function declarations() {
            var decls = [];
            if (!open()) {
                return error("missing '{'");
            }
            comments(decls);
            var decl;
            while ((decl = declaration())) {
                if (decl !== false) {
                    decls.push(decl);
                    comments(decls);
                }
                decl = declaration();
            }
            if (!close()) {
                return error("missing '}'");
            }
            return decls;
        }
        function keyframe() {
            var m;
            var vals = [];
            var pos = position();
            while ((m = match(/^((\d+\.\d+|\.\d+|\d+)%?|[a-z]+)\s*/))) {
                vals.push(m[1]);
                match(/^,\s*/);
            }
            if (!vals.length) {
                return;
            }
            return pos({
                type: 'keyframe',
                values: vals,
                declarations: declarations(),
            });
        }
        function atkeyframes() {
            var pos = position();
            var m = match(/^@([-\w]+)?keyframes\s*/);
            if (!m) {
                return;
            }
            var vendor = m[1];
            m = match(/^([-\w]+)\s*/);
            if (!m) {
                return error('@keyframes missing name');
            }
            var name = m[1];
            if (!open()) {
                return error("@keyframes missing '{'");
            }
            var frame;
            var frames = comments();
            while ((frame = keyframe())) {
                frames.push(frame);
                frames = frames.concat(comments());
            }
            if (!close()) {
                return error("@keyframes missing '}'");
            }
            return pos({
                type: 'keyframes',
                name: name,
                vendor: vendor,
                keyframes: frames,
            });
        }
        function atsupports() {
            var pos = position();
            var m = match(/^@supports *([^{]+)/);
            if (!m) {
                return;
            }
            var supports = trim(m[1]);
            if (!open()) {
                return error("@supports missing '{'");
            }
            var style = comments().concat(rules());
            if (!close()) {
                return error("@supports missing '}'");
            }
            return pos({
                type: 'supports',
                supports: supports,
                rules: style,
            });
        }
        function athost() {
            var pos = position();
            var m = match(/^@host\s*/);
            if (!m) {
                return;
            }
            if (!open()) {
                return error("@host missing '{'");
            }
            var style = comments().concat(rules());
            if (!close()) {
                return error("@host missing '}'");
            }
            return pos({
                type: 'host',
                rules: style,
            });
        }
        function atmedia() {
            var pos = position();
            var m = match(/^@media *([^{]+)/);
            if (!m) {
                return;
            }
            var media = trim(m[1]);
            if (!open()) {
                return error("@media missing '{'");
            }
            var style = comments().concat(rules());
            if (!close()) {
                return error("@media missing '}'");
            }
            return pos({
                type: 'media',
                media: media,
                rules: style,
            });
        }
        function atcustommedia() {
            var pos = position();
            var m = match(/^@custom-media\s+(--[^\s]+)\s*([^{;]+);/);
            if (!m) {
                return;
            }
            return pos({
                type: 'custom-media',
                name: trim(m[1]),
                media: trim(m[2]),
            });
        }
        function atpage() {
            var pos = position();
            var m = match(/^@page */);
            if (!m) {
                return;
            }
            var sel = selector() || [];
            if (!open()) {
                return error("@page missing '{'");
            }
            var decls = comments();
            var decl;
            while ((decl = declaration())) {
                decls.push(decl);
                decls = decls.concat(comments());
            }
            if (!close()) {
                return error("@page missing '}'");
            }
            return pos({
                type: 'page',
                selectors: sel,
                declarations: decls,
            });
        }
        function atdocument() {
            var pos = position();
            var m = match(/^@([-\w]+)?document *([^{]+)/);
            if (!m) {
                return;
            }
            var vendor = trim(m[1]);
            var doc = trim(m[2]);
            if (!open()) {
                return error("@document missing '{'");
            }
            var style = comments().concat(rules());
            if (!close()) {
                return error("@document missing '}'");
            }
            return pos({
                type: 'document',
                document: doc,
                vendor: vendor,
                rules: style,
            });
        }
        function atfontface() {
            var pos = position();
            var m = match(/^@font-face\s*/);
            if (!m) {
                return;
            }
            if (!open()) {
                return error("@font-face missing '{'");
            }
            var decls = comments();
            var decl;
            while ((decl = declaration())) {
                decls.push(decl);
                decls = decls.concat(comments());
            }
            if (!close()) {
                return error("@font-face missing '}'");
            }
            return pos({
                type: 'font-face',
                declarations: decls,
            });
        }
        var atimport = _compileAtrule('import');
        var atcharset = _compileAtrule('charset');
        var atnamespace = _compileAtrule('namespace');
        function _compileAtrule(name) {
            var re = new RegExp('^@' + name + '\\s*([^;]+);');
            return function () {
                var pos = position();
                var m = match(re);
                if (!m) {
                    return;
                }
                var ret = { type: name };
                ret[name] = m[1].trim();
                return pos(ret);
            };
        }
        function atrule() {
            if (css[0] !== '@') {
                return;
            }
            return (atkeyframes() ||
                atmedia() ||
                atcustommedia() ||
                atsupports() ||
                atimport() ||
                atcharset() ||
                atnamespace() ||
                atdocument() ||
                atpage() ||
                athost() ||
                atfontface());
        }
        function rule() {
            var pos = position();
            var sel = selector();
            if (!sel) {
                return error('selector missing');
            }
            comments();
            return pos({
                type: 'rule',
                selectors: sel,
                declarations: declarations(),
            });
        }
        return addParent(stylesheet());
    }
    function trim(str) {
        return str ? str.replace(/^\s+|\s+$/g, '') : '';
    }
    function addParent(obj, parent) {
        var isNode = obj && typeof obj.type === 'string';
        var childParent = isNode ? obj : parent;
        for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
            var k = _a[_i];
            var value = obj[k];
            if (Array.isArray(value)) {
                value.forEach(function (v) {
                    addParent(v, childParent);
                });
            }
            else if (value && typeof value === 'object') {
                addParent(value, childParent);
            }
        }
        if (isNode) {
            Object.defineProperty(obj, 'parent', {
                configurable: true,
                writable: true,
                enumerable: false,
                value: parent || null,
            });
        }
        return obj;
    }
  
    var tagMap = {
        script: 'noscript',
        altglyph: 'altGlyph',
        altglyphdef: 'altGlyphDef',
        altglyphitem: 'altGlyphItem',
        animatecolor: 'animateColor',
        animatemotion: 'animateMotion',
        animatetransform: 'animateTransform',
        clippath: 'clipPath',
        feblend: 'feBlend',
        fecolormatrix: 'feColorMatrix',
        fecomponenttransfer: 'feComponentTransfer',
        fecomposite: 'feComposite',
        feconvolvematrix: 'feConvolveMatrix',
        fediffuselighting: 'feDiffuseLighting',
        fedisplacementmap: 'feDisplacementMap',
        fedistantlight: 'feDistantLight',
        fedropshadow: 'feDropShadow',
        feflood: 'feFlood',
        fefunca: 'feFuncA',
        fefuncb: 'feFuncB',
        fefuncg: 'feFuncG',
        fefuncr: 'feFuncR',
        fegaussianblur: 'feGaussianBlur',
        feimage: 'feImage',
        femerge: 'feMerge',
        femergenode: 'feMergeNode',
        femorphology: 'feMorphology',
        feoffset: 'feOffset',
        fepointlight: 'fePointLight',
        fespecularlighting: 'feSpecularLighting',
        fespotlight: 'feSpotLight',
        fetile: 'feTile',
        feturbulence: 'feTurbulence',
        foreignobject: 'foreignObject',
        glyphref: 'glyphRef',
        lineargradient: 'linearGradient',
        radialgradient: 'radialGradient',
    };
    function getTagName(n) {
        var tagName = tagMap[n.tagName] ? tagMap[n.tagName] : n.tagName;
        if (tagName === 'link' && n.attributes._cssText) {
            tagName = 'style';
        }
        return tagName;
    }
    var HOVER_SELECTOR = /([^\\]):hover/g;
    function addHoverClass(cssText) {
        var ast = parse(cssText, { silent: true });
        if (!ast.stylesheet) {
            return cssText;
        }
        ast.stylesheet.rules.forEach(function (rule) {
            if ('selectors' in rule) {
                (rule.selectors || []).forEach(function (selector) {
                    if (HOVER_SELECTOR.test(selector)) {
                        var newSelector = selector.replace(HOVER_SELECTOR, '$1.\\:hover');
                        cssText = cssText.replace(selector, selector + ", " + newSelector);
                    }
                });
            }
        });
        return cssText;
    }
    function buildNode(n, doc, HACK_CSS) {
        switch (n.type) {
            case exports.NodeType.Document:
                return doc.implementation.createDocument(null, '', null);
            case exports.NodeType.DocumentType:
                return doc.implementation.createDocumentType(n.name, n.publicId, n.systemId);
            case exports.NodeType.Element:
                var tagName = getTagName(n);
                var node_1;
                if (n.isSVG) {
                    node_1 = doc.createElementNS('http://www.w3.org/2000/svg', tagName);
                }
                else {
                    node_1 = doc.createElement(tagName);
                }
                var _loop_1 = function (name) {
                    if (!n.attributes.hasOwnProperty(name)) {
                        return "continue";
                    }
                    var value = n.attributes[name];
                    value =
                        typeof value === 'boolean' || typeof value === 'number' ? '' : value;
                    if (!name.startsWith('rr_')) {
                        var isTextarea = tagName === 'textarea' && name === 'value';
                        var isRemoteOrDynamicCss = tagName === 'style' && name === '_cssText';
                        if (isRemoteOrDynamicCss && HACK_CSS) {
                            value = addHoverClass(value);
                        }
                        if (isTextarea || isRemoteOrDynamicCss) {
                            var child = doc.createTextNode(value);
                            for (var _i = 0, _a = Array.from(node_1.childNodes); _i < _a.length; _i++) {
                                var c = _a[_i];
                                if (c.nodeType === node_1.TEXT_NODE) {
                                    node_1.removeChild(c);
                                }
                            }
                            node_1.appendChild(child);
                            return "continue";
                        }
                        try {
                            if (n.isSVG && name === 'xlink:href') {
                                node_1.setAttributeNS('http://www.w3.org/1999/xlink', name, value);
                            }
                            else if (name === 'onload' ||
                                name === 'onclick' ||
                                name.substring(0, 7) === 'onmouse') {
                                node_1.setAttribute('_' + name, value);
                            }
                            else {
                                node_1.setAttribute(name, value);
                            }
                        }
                        catch (error) {
                        }
                    }
                    else {
                        if (tagName === 'canvas' && name === 'rr_dataURL') {
                            var image_1 = document.createElement('img');
                            image_1.src = value;
                            image_1.onload = function () {
                                var ctx = node_1.getContext('2d');
                                if (ctx) {
                                    ctx.drawImage(image_1, 0, 0, image_1.width, image_1.height);
                                }
                            };
                        }
                        if (name === 'rr_width') {
                            node_1.style.width = value;
                        }
                        if (name === 'rr_height') {
                            node_1.style.height = value;
                        }
                        if (name === 'rr_mediaState') {
                            switch (value) {
                                case 'played':
                                    node_1.play();
                                case 'paused':
                                    node_1.pause();
                                    break;
                                default:
                            }
                        }
                    }
                };
                for (var name in n.attributes) {
                    _loop_1(name);
                }
                return node_1;
            case exports.NodeType.Text:
                return doc.createTextNode(n.isStyle && HACK_CSS ? addHoverClass(n.textContent) : n.textContent);
            case exports.NodeType.CDATA:
                return doc.createCDATASection(n.textContent);
            case exports.NodeType.Comment:
                return doc.createComment(n.textContent);
            default:
                return null;
        }
    }
    function buildNodeWithSN(n, doc, map, skipChild, HACK_CSS) {
        if (skipChild === void 0) { skipChild = false; }
        if (HACK_CSS === void 0) { HACK_CSS = true; }
        var node = buildNode(n, doc, HACK_CSS);
        if (!node) {
            return null;
        }
        if (n.type === exports.NodeType.Document) {
            doc.close();
            doc.open();
            node = doc;
        }
        node.__sn = n;
        map[n.id] = node;
        if ((n.type === exports.NodeType.Document || n.type === exports.NodeType.Element) &&
            !skipChild) {
            for (var _i = 0, _a = n.childNodes; _i < _a.length; _i++) {
                var childN = _a[_i];
                var childNode = buildNodeWithSN(childN, doc, map, false, HACK_CSS);
                if (!childNode) {
                    console.warn('Failed to rebuild', childN);
                }
                else {
                    node.appendChild(childNode);
                }
            }
        }
        return node;
    }
    function visit(idNodeMap, onVisit) {
        function walk(node) {
            onVisit(node);
        }
        for (var key in idNodeMap) {
            if (idNodeMap[key]) {
                walk(idNodeMap[key]);
            }
        }
    }
    function handleScroll(node) {
        var n = node.__sn;
        if (n.type !== exports.NodeType.Element) {
            return;
        }
        var el = node;
        for (var name in n.attributes) {
            if (!(n.attributes.hasOwnProperty(name) && name.startsWith('rr_'))) {
                continue;
            }
            var value = n.attributes[name];
            if (name === 'rr_scrollLeft') {
                el.scrollLeft = value;
            }
            if (name === 'rr_scrollTop') {
                el.scrollTop = value;
            }
        }
    }
    function rebuild(n, doc, onVisit, HACK_CSS) {
        if (HACK_CSS === void 0) { HACK_CSS = true; }
        var idNodeMap = {};
        var node = buildNodeWithSN(n, doc, idNodeMap, false, HACK_CSS);
        visit(idNodeMap, function (visitedNode) {
            if (onVisit) {
                onVisit(visitedNode);
            }
            handleScroll(visitedNode);
        });
        return [node, idNodeMap];
    }
  
    exports.snapshot = snapshot;
    exports.serializeNodeWithId = serializeNodeWithId;
    exports.rebuild = rebuild;
    exports.buildNodeWithSN = buildNodeWithSN;
    exports.addHoverClass = addHoverClass;
    exports.transformAttribute = transformAttribute;
    exports.visitSnapshot = visitSnapshot;
  
    return exports;
  
  }({}));
  