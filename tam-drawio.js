Draw.loadPlugin(function (ui) {
    const tamShapes = [];
    const isTamPluginMissingLabel = (cell) => cell?.style?.includes("tamPluginMissing");

    function createMissingLabel(page, x, y, width, height) {
        const newLabelMissing = new mxCell("Best viewed with the <a href=\"https://github.com/ariel-bentu/tam-drawio\">TAM plugin</a>",
            new mxGeometry(x, y, width, height), "text;html=1;shape=tamPluginMissing;");
        newLabelMissing.setVertex(true);
        newLabelMissing.setConnectable(false);
        page.insert(newLabelMissing);
    }

    ui.editor.graph.getSelectionModel().addListener(mxEvent.UNDO, (evt, sender) => {
        if (config.addPluginMissingLabel) {
            const selectedCells = ui.editor.graph.getSelectionCells();
            if (selectedCells?.length > 0) {
                // remove the label from selection list
                const filteredSelectedCells = selectedCells.filter(sc => !isTamPluginMissingLabel(sc));
                if (filteredSelectedCells.length < selectedCells.length) {
                    ui.editor.graph.setSelectionCells(filteredSelectedCells);
                }
            }
        }
    });

    let timer = undefined;
    ui.editor.graph.model.addListener(mxEvent.END_UPDATE, (evt, sender) => {
        if (config.addPluginMissingLabel) {
            if (evt?.currentEdit?.changes?.some(change => !isTamPluginMissingLabel(change?.cell))) {
                if (timer) {
                    clearTimeout(timer)
                }
                timer = setTimeout(() => initPluginMissingLabel(ui), 100);
            }
        }
    });

    function parseShape(elem) {
        let shapePos = elem.style?.indexOf("shape=");
        if (shapePos >= 0) {
            shapePos += 6;
            const semiColonPos = elem.style?.indexOf(";", shapePos);
            if (semiColonPos >= 0) {
                return elem.style.substring(shapePos, semiColonPos).trim();
            }
            return elem.style.substr(shapePos).trim();
        }
    }

    function initPluginMissingLabel(ui) {

        if (config.addPluginMissingLabel) {
            const page = ui.currentPage?.root?.children?.[0];
            const pageElems = page?.children;
            if (pageElems) {
                let missingLabel = undefined;
                let isTAMPluginNeeded = false;
                for (let i=0;i<pageElems.length;i++) {
                    const shape = parseShape(pageElems[i]);
                    if (shape) {
                        if (!missingLabel && shape === "tamPluginMissing") {
                            missingLabel = pageElems[i];
                            isTAMPluginNeeded = true;
                            // no need to search any more - we know it needs the plugin
                            break;
                        }
                        if (tamShapes.find(ts=>ts === shape)) {
                            isTAMPluginNeeded = true;
                        }
                    }
                }

                if (!isTAMPluginNeeded) {
                    return;
                }

                let maxX = 0, maxY = 0;
                let minX = 0, minY = 0;
                pageElems.forEach((child, i) => {
                    if (child.geometry && child !== missingLabel) {
                        const isEdge =  child.edge && child.geometry.sourcePoint && child.geometry.targetPoint
                        const x = isEdge ? Math.min(child.geometry.sourcePoint.x, child.geometry.targetPoint.x) : child.geometry.x;
                        const y = isEdge ? Math.min(child.geometry.sourcePoint.y, child.geometry.targetPoint.y) : child.geometry.y;
                        const endX = isEdge ? Math.max(child.geometry.sourcePoint.x, child.geometry.targetPoint.x) : x + child.geometry.width;
                        const endY = isEdge ? Math.max(child.geometry.sourcePoint.y, child.geometry.targetPoint.y) : y + child.geometry.height;

                        console.log(i, child.style.substr(0, 20), x, y, endX, endY);

                        minX = minX === 0 ? x : Math.min(x, minX);
                        minY = minY === 0 ? y : Math.min(y, minY);

                        maxX = maxX === 0 ? endX : Math.max(endX, maxX);
                        maxY = maxY === 0 ? endY : Math.max(endY, maxY);
                    }
                })
                const missingLabelWidth = 200;
                const missingLabelHeight = 25;
                const missingLabelX = minX + (maxX - minX - missingLabelWidth) / 2;
                const missingLabelY = maxY + missingLabelHeight + 5;
                if (missingLabel) {
                    ui.editor.graph.model.setGeometry(missingLabel, new mxGeometry(missingLabelX, missingLabelY, missingLabelWidth, missingLabelHeight));
                    ui.editor.graph.refresh();
                } else {
                    ui.editor.graph.model.beginUpdate();
                    try {
                        createMissingLabel(page, missingLabelX, missingLabelY, missingLabelWidth, missingLabelHeight);
                    } finally {
                        ui.editor.graph.model.endUpdate();
                    }
                }
            }
        }
    }

    function drawArrow(c, x1, y1, x2, y2, isVertical, isLeftUp, startArrow, endArrow) {
        let cWidth = isLeftUp ? -10 : 10;
        let dx = 1;
        let dy = 1;
        let ArrowLength = 4;

        c.begin();
        if (isVertical) {
            let h = y2 - y1;
            if (startArrow) {
                c.moveTo(x1 + (isLeftUp ? dx : ArrowLength), y1 + (isLeftUp ? ArrowLength : dy));
                c.lineTo(x1, y1);
                c.lineTo(x1 - (isLeftUp ? ArrowLength : dy), y1 + (isLeftUp ? dx : ArrowLength));
            }

            c.moveTo(x1, y1);
            c.curveTo(x1 + cWidth, y1 + h / 3,
                x1 + cWidth, y1 + 2 * h / 3,
                x1, y2);
            if (endArrow) {
                c.moveTo(x1 + (isLeftUp ? dx : ArrowLength), y2 - (isLeftUp ? ArrowLength : dy));
                c.lineTo(x1, y2);
                c.lineTo(x1 - (isLeftUp ? ArrowLength : dy), y2 - (isLeftUp ? dx : ArrowLength));
            }
        } else {
            let w = x2 - x1;
            if (startArrow) {
                c.moveTo(x1 + (isLeftUp ? dy : ArrowLength), y1 - (isLeftUp ? ArrowLength : dx));
                c.lineTo(x1, y1);
                c.lineTo(x1 + (isLeftUp ? ArrowLength : dx), y1 + (isLeftUp ? dy : ArrowLength));
            }
            c.moveTo(x1, y1);
            c.curveTo(x1 + w / 3, y1 + cWidth,
                x1 + 2 * w / 3, y1 + cWidth,
                x2, y1);
            if (endArrow) {
                c.moveTo(x2 - (isLeftUp ? dx : ArrowLength), y1 - (isLeftUp ? ArrowLength : dx));
                c.lineTo(x2, y1);
                c.lineTo(x2 - (isLeftUp ? ArrowLength : dy), y1 + (isLeftUp ? dx : ArrowLength));
            }
        }
        c.stroke();
    }

    function drawRect(c, x, y, w, h) {
        c.begin();
        c.moveTo(x, y);
        c.lineTo(x + w, y);
        c.lineTo(x + w, y + h);
        c.lineTo(x, y + h);
        c.lineTo(x, y);
        c.close();
        c.end();
        c.fillAndStroke()
    }

    function createHandle(state, keys, getPositionFn, setPositionFn, ignoreGrid, redrawEdges, executeFn) {
        const handle = new mxHandle(state, null, mxVertexHandler.prototype.secondaryHandleImage);

        handle.execute = function (me) {
            for (let i = 0; i < keys.length; i++) {
                this.copyStyle(keys[i]);
            }

            if (executeFn) {
                executeFn(me);
            }
        };

        handle.getPosition = getPositionFn;
        handle.setPosition = setPositionFn;
        handle.ignoreGrid = (ignoreGrid != null) ? ignoreGrid : true;

        // Overridden to update connected edges
        if (redrawEdges) {
            const positionChanged = handle.positionChanged;
            handle.positionChanged = function () {
                positionChanged.apply(this, arguments);

                // Redraws connected edges TODO: Include child edges
                state.view.invalidate(this.state.cell);
                state.view.validate();
            };
        }

        return handle;
    }

    const config = Object.assign(
        // defaults
        { addPluginMissingLabel: true },
        // user settings
        Editor?.globalVars?.tam
    );

    const tamConstants = {
        UP: 'up',
        DOWN: 'down',
        LEFT: 'left',
        RIGHT: 'right'
    };

    const rotatePosition = {
        [tamConstants.UP]: tamConstants.LEFT,
        [tamConstants.DOWN]: tamConstants.RIGHT,
        [tamConstants.LEFT]: tamConstants.UP,
        [tamConstants.RIGHT]: tamConstants.DOWN
    };

    const rotateDirection = {
        [mxConstants.DIRECTION_NORTH]: mxConstants.DIRECTION_EAST,
        [mxConstants.DIRECTION_SOUTH]: mxConstants.DIRECTION_WEST,
        [mxConstants.DIRECTION_EAST]: mxConstants.DIRECTION_NORTH,
        [mxConstants.DIRECTION_WEST]: mxConstants.DIRECTION_SOUTH,
        [mxConstants.NONE]: mxConstants.NONE,

    };

    const flipDirection = {
        [mxConstants.DIRECTION_NORTH]: mxConstants.DIRECTION_SOUTH,
        [mxConstants.DIRECTION_SOUTH]: mxConstants.DIRECTION_NORTH,
        [mxConstants.DIRECTION_EAST]: mxConstants.DIRECTION_WEST,
        [mxConstants.DIRECTION_WEST]: mxConstants.DIRECTION_EAST,
        [mxConstants.NONE]: mxConstants.NONE,
    }

    const tamUtils = {
        getStyleObject: styleString => styleString
            .split(';')
            .reduce(
                (acc, cur) => (
                    (([key, val]) => key && (acc[key] = val))(cur.split('=')),
                    acc
                ),
                {}
            ),
        getStyleString: styleObj => Object.keys(styleObj)
            .reduce((acc, cur) => acc + `${cur}=${styleObj[cur]};`, ''),
        registerCodec: codecClass => {
            const codec = new mxObjectCodec(new codecClass());
            codec.encode = enc => enc.document.createElement(codecClass.name);
            codec.decode = () => new codecClass();
            mxCodecRegistry.register(codec);
        }
    };

    class StorageCodec {
        create() {

            const cell = new mxCell(
                '',
                new mxGeometry(0, 0, 90, 40),
                tamUtils.getStyleString({
                    rounded: 1,
                    whiteSpace: 'wrap',
                    html: 1,
                    arcSize: 60
                })
            );
            cell.vertex = true;
            return cell;
        }
    }

    class VerticalUpdateEdgeCodec {
        create() {

            const cell = new mxCell(
                '',
                new mxGeometry(0, 0, 30, 80),
                tamUtils.getStyleString({
                    shape: 'updateedge',
                    endArrow: 'none',
                    vertical: true
                })
            );
            cell.geometry.relative = true;
            cell.edge = true;
            cell.geometry.setTerminalPoint(new mxPoint(15, 0), true);
            cell.geometry.setTerminalPoint(new mxPoint(15, 80), false);
            return cell;
        }
    }

    class HorizontalUpdateEdgeCodec {
        create() {
            const cell = new mxCell(
                '',
                new mxGeometry(0, 0, 80, 30),
                tamUtils.getStyleString({
                    shape: 'updateedge',
                    endArrow: 'none'
                })
            );
            cell.geometry.relative = true;
            cell.edge = true;
            cell.geometry.setTerminalPoint(new mxPoint(0, 15), true);
            cell.geometry.setTerminalPoint(new mxPoint(80, 15), false);
            return cell;
        }
    }

    class UpdateEdgeShape extends mxConnector {

        paintEdgeShape(c, pts, rounded) {

            c.setFillColor(this.stroke);
            c.setDashed(c.state.dashed, c.state.fixDash);
            c.setShadow(false);

            if (pts.length < 2) {
                return;
            }
            const isVertical = mxUtils.getValue(this.style, 'vertical', false);
            if (isVertical) {
                drawArrow(c, pts[0].x + 5, pts[0].y + 5, pts[1].x + 5, pts[1].y - 5, isVertical, false, true, false);
                drawArrow(c, pts[0].x - 5, pts[0].y + 5, pts[1].x - 5, pts[1].y - 5, isVertical, true, false, true);
            } else {
                drawArrow(c, pts[0].x + 5, pts[0].y - 5, pts[1].x - 5, pts[1].y - 5, isVertical, true, true, false);
                drawArrow(c, pts[0].x + 5, pts[0].y + 5, pts[1].x - 5, pts[1].y + 5, isVertical, false, false, true);
            }

            (sourceMarker => typeof sourceMarker === 'function' && sourceMarker())(this.createMarker(c, pts, true));
            (targetMarker => typeof targetMarker === 'function' && targetMarker())(this.createMarker(c, pts, false));
        }
        getLabelMargins(rect) {
            return new mxRectangle(0, 2.5 * Math.min(rect.height / 2,
                Math.round(rect.height / 8) + this.strokewidth - 1), 0, 0);
        }
    }

    class UseEdgeShape extends mxConnector {

        paintEdgeShape(c, pts, rounded) {
            c.setDashed(c.state.dashed, c.state.fixDash);
            c.setShadow(false);

            if (pts.length < 2) { return; }
            const isVertical = mxUtils.getValue(this.style, 'vertical', false);

            const prev = c.pointerEventsValue;
            c.pointerEventsValue = 'stroke';

            const drawEdge = (drawPoints) => {
                this.style && this.style[mxConstants.STYLE_CURVED] === '1' ?
                    this.paintCurvedLine(c, drawPoints) :
                    this.paintLine(c, drawPoints, this.isRounded);
            }

            const inBetween = (n, n1, n2) => {
                return (n >= n1 && n <= n2 || n >= n2 && n <= n1);
            }

            const circleRadius = 8;
            let x = 0, y = 0;
            let p0 = 0, p1 = 1;
            let vertLine = isVertical;

            let cx = mxUtils.getNumber(this.state.style, 'dx', -1);
            let cy = mxUtils.getNumber(this.state.style, 'dy', -1);
            let rectMsg = ""
            if (cx === -1 || cy === -1) {
                //uninitialized
                if (pts.length > 2) {
                    p0 = Math.floor(pts.length / 2) - 1;
                    p1 = p0 + 1;
                }
                let midPoint = getEdgeMidPoint(pts, isVertical);
                vertLine = (pts.length === 2) ? isVertical : !isVertical;
                x = midPoint.x;
                y = midPoint.y;
            } else {
                //calculate on-the-line point
                p0 = 0;
                p1 = 1;
                let left = Math.min(pts[0].x, pts[pts.length - 1].x);
                let top = Math.min(pts[0].y, pts[pts.length - 1].y);
                rectMsg = "[" + left + "," + top + "]"
                for (let i = 0; i < pts.length - 1; i++) {

                    if (pts[i].x === pts[i + 1].x || isVertical && pts.length === 2) {
                        if (inBetween(top + cy, pts[i].y, pts[i + 1].y)) {
                            y = top + cy;
                            x = pts[i].x;
                            p0 = i;
                            p1 = i + 1;
                            vertLine = true;

                            if (Math.abs(pts[i].x - (left + cx)) <= 2 * circleRadius) {
                                //found best match
                                break;
                            }
                        }
                    } else {
                        if (inBetween(left + cx, pts[i].x, pts[i + 1].x)) {
                            y = pts[i].y;
                            x = left + cx;
                            p0 = i;
                            p1 = i + 1;
                            vertLine = false;

                            if (Math.abs(pts[i].y - (top + cy)) <= 2 * circleRadius) {
                                //found best match
                                break;
                            }
                        }
                    }
                }
            }

            const lineDirectionCoefficient = vertLine ?
                (pts[p0].y > pts[p1].y ? 1 : -1) :
                (pts[p0].x < pts[p1].x ? 1 : -1);
            let cpt = vertLine ?
                new mxPoint(x, y + lineDirectionCoefficient * circleRadius) :
                new mxPoint(x - lineDirectionCoefficient * circleRadius, y);
            //ui.editor.setStatus(rectMsg + "--" + JSON.stringify(pts) + "--" + cpt.x + "," + cpt.y)
            let pts1 = [...pts.slice(0, p0 + 1), cpt]
            const strokeWidth = c.getCurrentStrokeWidth();
            c.setStrokeWidth(strokeWidth);
            drawEdge(pts1);

            c.setStrokeWidth(strokeWidth * 2);
            c.ellipse(
                x - circleRadius,
                y - circleRadius,
                circleRadius * 2,
                circleRadius * 2
            );
            c.stroke();
            c.setStrokeWidth(strokeWidth);
            cpt = vertLine ?
                new mxPoint(x, y - lineDirectionCoefficient * circleRadius) :
                new mxPoint(x + lineDirectionCoefficient * circleRadius, y)
            let endPoint =
                (pts.length === 2) ?
                    (vertLine ? new mxPoint(pts[0].x, pts[1].y) : new mxPoint(pts[1].x, pts[0].y)) :
                    pts[pts.length - 1];

            pts1 = [cpt, ...pts.slice(p1, pts.length - 1), endPoint];
            drawEdge(pts1);

            c.pointerEventsValue = prev;

            // Draw triangle
            let useSignPosition = mxUtils.getValue(this.style, 'useSignPosition', 'up');
            let useSignDirection = mxUtils.getValue(this.style, 'useSignDirection', 'none');

            // Preserve logical direction of triangle, when curve is flipped
            if (useSignDirection !== 'none' && lineDirectionCoefficient === -1) {
                useSignDirection = flipDirection[useSignDirection];
            }

            // Adjust the location to the position of the circle
            if (pts.length > 2 && p0 % 2 === 0) {
                useSignPosition = rotatePosition[useSignPosition];
                useSignDirection = rotateDirection[useSignDirection];
            }

            let dx, dy;
            let tpts, rpt
            const distance = 20;

            switch (useSignPosition) {
                case tamConstants.DOWN:
                    dy = distance;
                    dx = 0;
                    break;
                case tamConstants.LEFT:
                    dy = 0;
                    dx = -distance;

                    break;
                case tamConstants.RIGHT:
                    dy = 0;
                    dx = -distance;
                    break;
                case tamConstants.UP:
                default:
                    dy = -distance;
                    dx = 0;
            }
            switch (useSignDirection) {
                case mxConstants.NONE:
                    tpts = [];
                    rpt = [-5, -5];
                    break;
                case mxConstants.DIRECTION_NORTH:
                    dy += -5;
                    tpts = [[-5, 0], [0, -10], [5, 0], [0, -2]];
                    rpt = [-5, 5]
                    break;
                case mxConstants.DIRECTION_SOUTH:
                    dy += 5;
                    tpts = [[-5, 0], [0, 10], [5, 0], [0, 2]];
                    rpt = [-5, -15]
                    break;
                case mxConstants.DIRECTION_WEST:
                    dx += -5;
                    tpts = [[0, -5], [-10, 0], [0, 5], [-2, 0]];
                    rpt = [5, -5]
                    break;
                case mxConstants.DIRECTION_EAST:
                default:
                    dx += 5;
                    tpts = [[0, -5], [10, 0], [0, 5], [2, 0]];
                    rpt = [-15, -5]
            }
            c.translate(x + dx, y + dy);
            if (useSignDirection !== mxConstants.NONE) {
                c.begin()

                c.moveTo(tpts[0][0], tpts[0][1]);
                for (let i = 1; i < tpts.length; i++) {
                    c.lineTo(tpts[i][0], tpts[i][1]);
                }
                c.lineTo(tpts[0][0], tpts[0][1]);

                c.close();
                c.end();
                c.setFillColor(this.stroke)
                c.fillAndStroke();

                //Output the R
                c.setFontColor(this.stroke)
                c.text(rpt[0], rpt[1], 10, 10, "R");
            }

            // Disables shadows, dashed styles and fixes fill color for markers
            c.setFillColor(this.stroke);
            c.setShadow(false);
            c.setDashed(false);

            (sourceMarker => typeof sourceMarker === 'function' && sourceMarker())(this.createMarker(c, pts, true));
            (targetMarker => typeof targetMarker === 'function' && targetMarker())(this.createMarker(c, pts, false));
        }
    }

    class Dot3Shape extends mxCylinder {

        paintVertexShape(c, x, y, w, h) {
            const isVertical = mxUtils.getValue(this.style, 'vertical', false);
            const radius = isVertical ? 1/3 * w : 1/3 * h;
            const x1 = x + radius;
            const y1 = y + radius;
            const dx = isVertical ? 0 : radius * 3.6;
            const dy = isVertical ? radius * 3.6 : 0;

            c.setFillColor(this.stroke);
            for (let i = 0; i < 3; i++) {
                c.ellipse(x1 + i * dx, y1 + i * dy, radius, radius);
                c.fillAndStroke();
            }
        }
    }

    class AgentShape extends mxRectangleShape {
        paintVertexShape(c, x, y, w, h) {
            const multiple = mxUtils.getValue(this.style, 'multiple', false);
            const offsetSize = mxUtils.getValue(this.style, 'offsetSize', 8);
            const halfStrokeWidth = mxUtils.getValue(this.style, 'strokeWidth', 2) / 2;

            if (multiple) {
                // Fill ╗
                c.begin();
                c.moveTo(x + offsetSize, y + offsetSize);
                c.lineTo(x + offsetSize, y);
                c.lineTo(x + w, y);
                c.lineTo(x + w, y + h - offsetSize);
                c.lineTo(x + w - offsetSize, y + h - offsetSize);
                c.lineTo(x + w - offsetSize, y + offsetSize);
                c.close();
                c.fill();
                c.end();
                // Stroke ╗
                c.begin();
                c.moveTo(x + offsetSize, y + offsetSize - halfStrokeWidth);
                c.lineTo(x + offsetSize, y);
                c.lineTo(x + w, y);
                c.lineTo(x + w, y + h - offsetSize);
                c.lineTo(x + w - offsetSize + halfStrokeWidth, y + h - offsetSize);
                c.stroke();
                c.end();
                // Fill and stroke front rectangle
                drawRect(c, x, y + offsetSize, w - offsetSize, h - offsetSize);
            } else {
                drawRect(c, x, y, w, h);
            }
        }
        getLabelBounds(rect) {
            const multiple = mxUtils.getValue(this.style, 'multiple', false);
            const offsetSize = mxUtils.getValue(this.style, 'offsetSize', 8);
            return new mxRectangle(rect.x, rect.y + (multiple ? offsetSize : 0), rect.width + (multiple ? -offsetSize : 0), rect.height + (multiple ? -offsetSize : 0));
        }
    }

    class ActorShape extends mxRectangleShape {
        paintVertexShape(c, x, y, w, h) {
            //we maintain aspect ratio
            w = 2 * h / 3
            const border = mxUtils.getValue(this.style, 'border', true);
            if (border)
                drawRect(c, x, y, w, h);
            let margin = mxUtils.getValue(this.style, 'margin', h / 10);
            x += margin / 2;
            y += margin / 2;
            w -= margin;
            h -= margin;

            c.translate(x, y);

            // Head
            c.ellipse(w / 4, 0, w / 2, h / 4);
            c.fillAndStroke();

            c.begin();
            c.moveTo(w / 2, h / 4);
            c.lineTo(w / 2, 2 * h / 3);

            // Arms
            c.moveTo(w / 2, h / 3 + 3);
            c.lineTo(0, h / 3);
            c.moveTo(w / 2, h / 3 + 3);
            c.lineTo(w, h / 3);

            // Legs
            c.moveTo(w / 2, 2 * h / 3);
            c.lineTo(0, h);
            c.moveTo(w / 2, 2 * h / 3);
            c.lineTo(w, h);
            c.end();

            c.stroke();
        }
    }

    class LShape extends mxRectangleShape {
        paintVertexShape(c, x, y, w, h) {
            const margin = mxUtils.getValue(this.style, 'margin', h / 10);
            const dx = mxUtils.getValue(this.style, 'dx', 80);
            const dy = mxUtils.getValue(this.style, 'dy', 20);

            c.begin();
            c.moveTo(x, y);
            c.lineTo(x + w, y);
            c.lineTo(x + w, y + dy);
            c.lineTo(x + dx, y + dy);
            c.lineTo(x + dx, y + h);
            c.lineTo(x, y + h);
            c.lineTo(x, y);
            c.close();
            c.end();
            c.fillAndStroke();
        }
    }

    class UShape extends mxRectangleShape {
        paintVertexShape(c, x, y, w, h) {
            const margin = mxUtils.getValue(this.style, 'margin', h / 10);
            const dx = mxUtils.getValue(this.style, 'dx', 20);
            const dy = mxUtils.getValue(this.style, 'dy', 80);

            c.begin();
            c.moveTo(x, y);
            c.lineTo(x + dx, y);
            c.lineTo(x + dx, y + dy);
            c.lineTo(x + w - dx, y + dy);
            c.lineTo(x + w - dx, y);
            c.lineTo(x + w, y);
            c.lineTo(x + w, y + h);
            c.lineTo(x, y + h);
            c.lineTo(x, y);
            c.close();
            c.end();
            c.fillAndStroke();
        }
    }

    class EndActivity extends mxDoubleEllipse {
        paintVertexShape(c, x, y, w, h) {
            c.ellipse(x, y, w, h);
            c.stroke();
            x += w / 5;
            y += h / 5;
            w -= 2 * w / 5;
            h -= 2 * h / 5;

            if (w > 0 && h > 0) {
                c.ellipse(x, y, w, h);
                c.fillAndStroke();
            }
        }
    }

    class HideTamComment extends mxText {
        paint(c, update) {
            if (this?.style?.shape !== "tamPluginMissing") {
                mxText.prototype.paint.call(this, c, update);
            }
        }
    }
    mxCellRenderer.prototype.defaultTextShape = HideTamComment

    // Register codecs
    tamUtils.registerCodec(StorageCodec);
    tamUtils.registerCodec(VerticalUpdateEdgeCodec);
    tamUtils.registerCodec(HorizontalUpdateEdgeCodec);

    // Register custom shapes
    mxCellRenderer.registerShape('updateedge', UpdateEdgeShape);
    mxCellRenderer.registerShape('useedge', UseEdgeShape);
    mxCellRenderer.registerShape('dot3', Dot3Shape);
    mxCellRenderer.registerShape('agent', AgentShape);
    mxCellRenderer.registerShape('actor', ActorShape);
    mxCellRenderer.registerShape('lshape', LShape);
    mxCellRenderer.registerShape('ushape', UShape);
    mxCellRenderer.registerShape('endactivity', EndActivity);

    tamShapes.push('updateedge');
    tamShapes.push('useedge');
    tamShapes.push('dot3');
    tamShapes.push('agent');
    tamShapes.push('actor');
    tamShapes.push('lshape');
    tamShapes.push('ushape');
    tamShapes.push('endactivity');





    // Adds custom sidebar entry
    const arrowPrefix = "edgeStyle=elbowEdgeStyle;html=1;labelBackgroundColor=none;rounded=1;";

    Sidebar.prototype.tam = ['Block', 'Class', 'Activity', 'Annotate'];

    ui.sidebar.configuration.push({ id: 'tam', prefix: 'tam', libs: Sidebar.prototype.tam })
    ui.sidebar.entries.find((e) => e.title === 'Software').entries.push({ title: 'TAM', id: 'tam' }); //TODO image: will show an image on the shapes selection admin ui

    ui.sidebar.setCurrentSearchEntryLibrary('tam', 'tamBlock');
    ui.sidebar.addPalette('tamBlock', 'TAM / Block', true, function (content) {
        content.appendChild(ui.sidebar.createEdgeTemplate('shape=useedge;vertical=true;edgeStyle=none;endArrow=none;useSignPosition=left;useSignDirection=south;', 0, 160, '', 'Vertical Channel'));
        content.appendChild(ui.sidebar.createEdgeTemplate('shape=useedge;endArrow=none;edgeStyle=none;useSignPosition=up;useSignDirection=east;', 160, 0, '', 'Horizontal Channel'));
        content.appendChild(ui.sidebar.createEdgeTemplate('rounded=1;shape=useedge;vertical=true;edgeStyle=elbowEdgeStyle;elbow=vertical;endArrow=none;useSignPosition=up;useSignDirection=east;', 70, 160, '', 'Vertical S-Channel'));
        content.appendChild(ui.sidebar.createEdgeTemplate('rounded=1;shape=useedge;edgeStyle=elbowEdgeStyle;elbow=horizontal;endArrow=none;useSignPosition=left;useSignDirection=south;', 160, 70, '', 'Horizontal S-Channel'));
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=1;whiteSpace=wrap;html=1;arcSize=60;strokeWidth=2;', 90, 40, '', 'Storage'));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([VerticalUpdateEdgeCodec.prototype.create()], 160, 0, 'Vertical Access'));
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([HorizontalUpdateEdgeCodec.prototype.create()], 160, 0, 'Horizontal Access'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=agent;offsetSize=8;strokeWidth=2;', 100, 60, '', 'Agent'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=agent;offsetSize=8;strokeWidth=2;multiple=true;', 100, 60, '', 'Stacked Agents'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=actor;horizontalLabelPosition=right;align=left;labelPosition=right;strokeWidth=2;aspect=fixed;', 35, 50, '', 'Human Actor'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=actor;horizontalLabelPosition=right;align=left;labelPosition=right;strokeWidth=2;border=0;aspect=fixed;', 35, 50, '', 'Human'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=lshape;dx=20;dy=20;strokeWidth=2;labelPosition=center;verticalLabelPosition=middle;align=center;verticalAlign=top;', 100, 100, '', 'L-Agent'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=ushape;dx=20;dy=80;strokeWidth=2;labelPosition=center;verticalLabelPosition=middle;align=center;verticalAlign=bottom;', 100, 100, '', 'U-Agent'));
        content.appendChild(ui.sidebar.createEdgeTemplate(arrowPrefix + 'elbow=vertical;endArrow=classic;endFill=1;align=center;', 80, 80, '', 'Vertical Uni-Directional S-Access'));
        content.appendChild(ui.sidebar.createEdgeTemplate(arrowPrefix + 'elbow=horizontal;endArrow=classic;endFill=1;align=left;', 80, 80, '', 'Horizontal Uni-Directional S-Access'));
        content.appendChild(ui.sidebar.createEdgeTemplate(arrowPrefix + 'elbow=horizontal;endArrow=none;endFill=0;align=left;', 80, 80, '', 'Vertical Bi-Directional S-Access'));
        content.appendChild(ui.sidebar.createEdgeTemplate(arrowPrefix + 'elbow=vertical;endArrow=none;endFill=0;align=center;', 80, 80, '', 'Horizontal Bi-Directional S-Access'));
    });

    ui.sidebar.addPalette('tamAnnotate', 'TAM / Annotate', true, function (content) {
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=0;whiteSpace=wrap;html=1;strokeWidth=0;strokeColor=none;fillColor=#E6E6E6;align=left;verticalAlign=top;spacingLeft=2;', 140, 80, '', 'Area'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=dot3;vertical=true;connectable=0;aspect=fixed;', 15, 55, '', 'Vertical Ellipsis'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=dot3;connectable=0;aspect=fixed;', 55, 15, '', 'Horizontal Ellipsis'));
        content.appendChild(ui.sidebar.createEdgeTemplate('edgeStyle=elbowEdgeStyle;dashed=1;dashPattern=5 5;strokeWidth=2;arcSize=0;startArrow=none;endArrow=none;startSize=0;endSize=0;html=1;endFill=0;align=left;resizeWidth=0;rounded=0;', 0, 300, '', 'Border Vertical'))
        content.appendChild(ui.sidebar.createEdgeTemplate('edgeStyle=elbowEdgeStyle;dashed=1;dashPattern=5 5;strokeWidth=2;arcSize=0;startArrow=none;endArrow=none;startSize=0;endSize=0;html=1;endFill=0;align=center;resizeHeight=0;rounded=0;', 300, 0, '', 'Border Horizontal'))
        content.appendChild(ui.sidebar.createVertexTemplate('shape=note2;boundedLbl=1;whiteSpace=wrap;html=1;size=10;spacingLeft=2;verticalAlign=top;align=left;fillColor=#FFFFFF;connectable=1', 70, 70, '', 'Note'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=curlyBracket;whiteSpace=wrap;html=1;rounded=1;size=0.5;labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;', 30, 150, 'Description', 'Left Curly Brace'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=curlyBracket;whiteSpace=wrap;html=1;rounded=1;flipH=1;labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;', 30, 150, 'Description', 'Right Curly Brace'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=curlyBracket;whiteSpace=wrap;html=1;rounded=1;flipH=1;labelPosition=center;verticalLabelPosition=top;align=center;verticalAlign=bottom;flipV=0;direction=south;', 150, 30, 'Description', 'Top Curly Brace'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=curlyBracket;whiteSpace=wrap;html=1;rounded=1;flipH=1;labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;flipV=0;direction=north;', 150, 30, 'Description', 'Bottom Curly Brace'));
    });

    ui.sidebar.addPalette('tamActivity', 'TAM / Activity', false, function (content) {
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=1;whiteSpace=wrap;html=1;strokeWidth=2;arcSize=37', 90, 40, '', 'Action'));
        content.appendChild(ui.sidebar.createVertexTemplate('ellipse;whiteSpace=wrap;html=1;aspect=fixed;fillColor=#000000;aspect=fixed;', 30, 30, '', 'Start of Activity'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=endactivity;strokeWidth=2;fillColor=#000000;aspect=fixed;', 30, 30, '', 'End of Activity'));
        content.appendChild(ui.sidebar.createVertexTemplate('rhombus;html=1;strokeWidth=2;aspect=fixed;', 30, 30, '', 'Decision or Merge'));
        content.appendChild(ui.sidebar.createEdgeTemplate(arrowPrefix + 'elbow=vertical;endArrow=classic;endFill=1;align=center;', 80, 80, '', 'Vertical  S-Flow'));
        content.appendChild(ui.sidebar.createEdgeTemplate(arrowPrefix + 'elbow=horizontal;endArrow=classic;endFill=1;align=left;', 80, 80, '', 'Horizontal S-Flow'));
        content.appendChild(ui.sidebar.createEdgeTemplate('edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;startArrow=none;startFill=0;endArrow=classic;endFill=1;startSize=6;endSize=6;align=center;fontSize=12;labelBackgroundColor=none;', 40, 40, '', 'L-Flow'));
        content.appendChild(ui.sidebar.createVertexTemplate('line;strokeWidth=13;html=1;fillColor=default;', 120, 10, '', 'Fork or Join'));
        content.appendChild(ui.sidebar.createVertexTemplate('shape=sumEllipse;perimeter=ellipsePerimeter;whiteSpace=wrap;html=1;backgroundOutline=1;strokeWidth=2;aspect=fixed;', 30, 30, '', 'End of Flow'));
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=0;whiteSpace=wrap;html=1;strokeWidth=2;fillColor=default;', 90, 40, '', 'State'));
    });

    ui.sidebar.addPalette('tamClass', 'TAM / Class', false, function (content) {
        content.appendChild(ui.sidebar.createVertexTemplate('shape=folder;fontStyle=1;align=left;spacingLeft=2;boundedLbl=1;labelInHeader=1;container=1;collapsible=0;recursiveResize=0;tabWidth=100;tabHeight=20;tabPosition=left;html=1;fontSize=12;fillColor=#E6E6E6;strokeWidth=2;', 250, 140, 'package', 'Class'));
        content.appendChild(ui.sidebar.createVertexTemplate('rounded=0;whiteSpace=wrap;html=1;strokeWidth=2;', 140, 70, '', 'Class'));
        // Add Class with items
        var field = new mxCell('List Item', new mxGeometry(0, 0, 60, 26), 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;');
        field.vertex = true;
        const cell = new mxCell('Class', new mxGeometry(0, 0, 140, 110),
            'swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;fillColor=none;horizontalStack=0;' +
            'resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;');
        cell.vertex = true;
        cell.insert(ui.sidebar.cloneCell(field, 'Attribute 1'));
        cell.insert(ui.sidebar.cloneCell(field, 'Operation 1'));

        content.appendChild(ui.sidebar.createVertexTemplateFromCells([cell], cell.geometry.width, cell.geometry.height, 'Class with compartments'));

        const edgeTemplate = new mxCell('', new mxGeometry(0, 0, 80, 80),
            'edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;endArrow=0;endFill=0;startSize=15;endSize=15;align=center;fontSize=12;labelBackgroundColor=none;');
        edgeTemplate.geometry.setTerminalPoint(new mxPoint(0, 0), true);
        edgeTemplate.geometry.setTerminalPoint(new mxPoint(80, 80), false);
        edgeTemplate.geometry.relative = true;
        edgeTemplate.edge = true;


        var cell0 = new mxCell('x..y', new mxGeometry(1, 0, 0, 0), 'edgeLabel;resizable=0;html=1;align=right;verticalAlign=bottom;');
        cell0.geometry.relative = true;
        cell0.setConnectable(false);
        cell0.vertex = true;
        cell0.geometry.offset = new mxPoint(-3, 1);
        edgeTemplate.insert(cell0);

        var cell1 = new mxCell('x..y', new mxGeometry(-1, 0, 0, 0), 'edgeLabel;resizable=0;html=1;align=left;verticalAlign=bottom;');
        cell1.geometry.relative = true;
        cell1.setConnectable(false);
        cell1.vertex = true;
        cell1.geometry.offset = new mxPoint(-1, -3);
        edgeTemplate.insert(cell1);

        const e1 = edgeTemplate;
        const origStyle = e1.style;
        e1.style = origStyle + ';startArrow=none;startFill=0;'
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([e1], e1.geometry.width, e1.geometry.height, 'Association'));

        e1.style = origStyle + ';startArrow=diamondThin;startFill=0;'
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([e1], e1.geometry.width, e1.geometry.height, 'Aggregation'));

        e1.style = origStyle + ';startArrow=diamondThin;startFill=1;'
        content.appendChild(ui.sidebar.createEdgeTemplateFromCells([e1], e1.geometry.width, e1.geometry.height, 'Composition'));

        content.appendChild(ui.sidebar.createEdgeTemplate('endArrow=block;html=1;rounded=1;edgeStyle=orthogonalEdgeStyle;endFill=0;strokeWidth=1;endSize=14', 80, 80, '', 'Specialization'));
    });

    ui.sidebar.setCurrentSearchEntryLibrary();


    mxResources.parse('flipUse=Flip Use Direction');

    function getEdgeMidPoint(pts, isVertical) {
        let p0 = 0, p1 = 1;
        let vertLine = (pts.length === 2) ? isVertical : !isVertical;

        if (pts.length > 2) {
            p0 = Math.floor(pts.length / 2) - 1;
            p1 = p0 + 1;
        }

        let x = vertLine ? pts[p0].x : pts[p0].x + (pts[p1].x - pts[p0].x) / 2;
        let y = vertLine ? pts[p0].y + (pts[p1].y - pts[p0].y) / 2 : pts[p0].y;
        return new mxPoint(x, y);
    }


    // Adds action
    ui.actions.addAction('flipUse', function () {

        if (!ui.editor.graph.isSelectionEmpty() && !ui.editor.graph.isEditing()) {

            const cells = ui.editor.graph.getSelectionCells();
            let style = tamUtils.getStyleObject(cells[0].style);
            let isVertical = style.edgeStyle == 'elbowEdgeStyle' ? style.vertical : !style.vertical;
            if (style.shape !== 'useedge') {
                return;
            }

            // south => north => none => south => ...
            // east => west => none => east => ...
            switch (style.useSignDirection) {
                case 'north':
                    style.useSignDirection = 'none'
                    break;
                case 'south':
                    style.useSignDirection = 'north'
                    break;
                case 'west':
                    style.useSignDirection = 'none'
                    break;
                case 'east':
                    style.useSignDirection = 'west'
                    break;
                case 'none':
                    style.useSignDirection = isVertical ? 'east' : 'south';
                    break;
            }

            cells[0].setStyle(mxUtils.setStyle(cells[0].style, 'useSignDirection', style.useSignDirection));
            ui.editor.graph.refresh(cells[0]);
        }
    });

    ui.actions.addAction('toggleMultiplicity', function () {

        if (!ui.editor.graph.isSelectionEmpty() && !ui.editor.graph.isEditing()) {
            const cells = ui.editor.graph.getSelectionCells();
            let style = tamUtils.getStyleObject(cells[0].style);
            if (style.shape == "agent") {
                let newMultiple = style.multiple ? undefined : "true";
                cells[0].setStyle(mxUtils.setStyle(cells[0].style, 'multiple', newMultiple));
                ui.editor.graph.refresh(cells[0]);
            }
        }
    });

    ui.toolbar.addSeparator();
    const elt = ui.toolbar.addItem('', 'flipUse');
    elt.firstChild.style.backgroundImage = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHhtbG5zOnhsaW5rPSdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJyB2ZXJzaW9uPScxLjEnIHdpZHRoPSc4MnB4JyBoZWlnaHQ9JzgycHgnIHZpZXdCb3g9Jy0wLjUgLTAuNSA4MiAyJz48Zz48cGF0aCBkPSdNIDAgMTAgTCAyMiAxMCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjMDAwMDAwJyBzdHJva2UtbWl0ZXJsaW1pdD0nMTAnIHBvaW50ZXItZXZlbnRzPSdzdHJva2UnIHN0cm9rZS13aWR0aD0nNCcvPjxlbGxpcHNlIGN4PSc0MCcgY3k9JzEwJyByeD0nMTgnIHJ5PScxOCcgZmlsbD0nbm9uZScgc3Ryb2tlPScjMDAwMDAwJyBwb2ludGVyLWV2ZW50cz0nc3Ryb2tlJyBzdHJva2Utd2lkdGg9JzgnLz48cGF0aCBkPSdNIDU4IDEwIEwgODAgMTAnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzAwMDAwMCcgc3Ryb2tlLW1pdGVybGltaXQ9JzEwJyBwb2ludGVyLWV2ZW50cz0nc3Ryb2tlJyBzdHJva2Utd2lkdGg9JzQnLz48cGF0aCBkPSdNIDQ1IC0zMCBMIDU1IC0yNSBMIDQ1IC0yMCBMIDQ3IC0yNSBMIDQ1IC0zMCBaJyBmaWxsPScjMDAwMDAwJyBzdHJva2U9JyMwMDAwMDAnIHN0cm9rZS1taXRlcmxpbWl0PScxMCcgcG9pbnRlci1ldmVudHM9J2FsbCcvPjxnIGZpbGw9JyMwMDAwMDAnIGZvbnQtZmFtaWx5PSdBcmlhbCxIZWx2ZXRpY2EnIGZvbnQtc2l6ZT0nMjJweCcgZm9udC13ZWlnaHQ9JzgwMCc+PHRleHQgeD0nMjQuNScgeT0nLTE5LjUnPlI8L3RleHQ+PC9nPjwvZz48L3N2Zz4=")';
    elt.firstChild.style.backgroundPosition = 'center';
    elt.firstChild.style.backgroundSize = 'contain';
    elt.firstChild.style.backgroundRepeat = 'no-repeat';

    const elt2 = ui.toolbar.addItem('', 'toggleMultiplicity');
    elt2.firstChild.style.backgroundImage = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHhtbG5zOnhsaW5rPSdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJyB2ZXJzaW9uPScxLjEnIHdpZHRoPSc4MnB4JyBoZWlnaHQ9JzgycHgnIHZpZXdCb3g9Jy0wLjUgLTAuNSAxMjAgOTYnPjxkZWZzLz48Zz48cGF0aCBkPSdNIDEgMzQgTCAxMDEgMzQgTCAxMDEgOTQgTCAxIDk0IEwgMSAzNCBaJyBmaWxsPSdub25lJyBzdHJva2U9JyMwMDAwMDAnIHN0cm9rZS13aWR0aD0nMicgc3Ryb2tlLW1pdGVybGltaXQ9JzEwJyBwb2ludGVyLWV2ZW50cz0nYWxsJy8+PHBhdGggZD0nTSA5IDM0IEwgOSAyNiBMIDEwOSAyNiBMIDEwOSA4NiBMIDEwMSA4NicgZmlsbD0nbm9uZScgc3Ryb2tlPScjMDAwMDAwJyBzdHJva2Utd2lkdGg9JzInIHN0cm9rZS1taXRlcmxpbWl0PScxMCcgcG9pbnRlci1ldmVudHM9J2FsbCcvPjxwYXRoIGQ9J00gMjMuMSA5IEwgODIuOSA5JyBmaWxsPSdub25lJyBzdHJva2U9JyMwMDAwMDAnIHN0cm9rZS13aWR0aD0nMycgc3Ryb2tlLW1pdGVybGltaXQ9JzEwJyBwb2ludGVyLWV2ZW50cz0nc3Ryb2tlJy8+PHBhdGggZD0nTSAxNi4zNSA5IEwgMjUuMzUgNC41IEwgMjMuMSA5IEwgMjUuMzUgMTMuNSBaJyBmaWxsPScjMDAwMDAwJyBzdHJva2U9JyMwMDAwMDAnIHN0cm9rZS13aWR0aD0nMycgc3Ryb2tlLW1pdGVybGltaXQ9JzEwJyBwb2ludGVyLWV2ZW50cz0nYWxsJy8+PHBhdGggZD0nTSA4OS42NSA5IEwgODAuNjUgMTMuNSBMIDgyLjkgOSBMIDgwLjY1IDQuNSBaJyBmaWxsPScjMDAwMDAwJyBzdHJva2U9JyMwMDAwMDAnIHN0cm9rZS13aWR0aD0nMycgc3Ryb2tlLW1pdGVybGltaXQ9JzEwJyBwb2ludGVyLWV2ZW50cz0nYWxsJy8+PC9nPjwvc3ZnPg==")';
    elt2.firstChild.style.backgroundPosition = 'center';
    elt2.firstChild.style.backgroundSize = 'contain';
    elt2.firstChild.style.backgroundRepeat = 'no-repeat';

    if (typeof mxVertexHandler !== 'undefined' && Graph.handleFactory && typeof Graph.handleFactory === "object") {
        const singleDxDyPoint = (state) => {
            return [
                createHandle(state, ['dx', 'dy'], function (bounds) {
                    var dx = Math.max(0, Math.min(bounds.width, mxUtils.getValue(this.state.style, 'dx', 0)));
                    var dy = Math.max(0, Math.min(bounds.height, mxUtils.getValue(this.state.style, 'dy', 0)));
                    let isVertical = mxUtils.getValue(this.state.style, 'vertical', false)
                    if (dx == 0 && dy == 0) {
                        //un initialize
                        let midPoint = getEdgeMidPoint(state.absolutePoints, isVertical);
                        dx = midPoint.x - state.x;
                        dy = midPoint.y - state.y;
                    }
                    return new mxPoint(bounds.x + dx + 8, bounds.y + dy - 8);
                }, function (bounds, pt) {
                    this.state.style['dx'] = Math.round(Math.max(0, Math.min(bounds.width, pt.x - bounds.x)));
                    this.state.style['dy'] = Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)));
                }, false)
            ]
        };

        Graph.handleFactory['lshape'] = singleDxDyPoint;
        Graph.handleFactory['ushape'] = singleDxDyPoint;
        Graph.handleFactory['useedge'] = singleDxDyPoint;
    }
});
