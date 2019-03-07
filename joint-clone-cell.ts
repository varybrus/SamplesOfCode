module Component.Joint {
    declare var joint;
    declare var _;
    declare var V;
    declare var g;
    declare var saveAs;

    export class CloneCellService {
        private updateLabel;
        private chengeLabelVisualIgnoreHistory;
        private selectService: SelectElementService;
        private jointHistoryService;
        private graph;
        private paper;
        private jointBootstrap: ComponentJoint;
        private cloneCellList: Array<any> = null;
        deltaMove;
        constructor(jointBootstrap: ComponentJoint, paper, graph, jointHistoryService, selectService: SelectElementService, updateLabel) {
            this.updateLabel = updateLabel;
            this.selectService = selectService;
            this.jointHistoryService = jointHistoryService;
            this.graph = graph;
            this.paper = paper;
            this.jointBootstrap = jointBootstrap;
        }

        private initBeforePast = (item): any => {
            var conceptId = item.get(CellAttribute.conceptId);
            item.set(CellAttribute.component, undefined);
            if (item.get(CellAttribute.linkSource))
                item.set(CellAttribute.linkSource, undefined);
            if (item.get(CellAttribute.mainFunction))
                item.set(CellAttribute.mainFunction, undefined);
            return item;
        }

        public copyCell() {
            this.deltaMove = this.paper.options.gridSize;
            this.cloneCellList = [];

            if (this.selectService.isEmpty() === false) {
                var selectedCellList = this.selectService.getSelectedElements();
                selectedCellList.forEach((cell) => {
                    cell.attributes.copyPastTag = { jointId: cell.id };
                    if (cell.get(CellAttribute.linkSource)) {
                        cell.attributes.copyPastTag.linkSource = cell.get(CellAttribute.linkSource);
                    }
                    if (cell.get(CellAttribute.mainFunction))
                        cell.attributes.copyPastTag.mainFunction = cell.get(CellAttribute.mainFunction);
                });
                ////relink link to clone element
                var linkList = selectedCellList.filter((item) => {
                    return item.isLink();
                });
                linkList.forEach((link) => {
                    var origLinkSourceId = link.attributes.source;
                    if (origLinkSourceId && origLinkSourceId.id) {
                        var boxS = this.paper.findViewByModel(this.graph.getCell(origLinkSourceId.id)).getBBox();
                        var sourceCenter = { x: boxS.x + boxS.width / 2, y: boxS.y + boxS.height }
                        link.attributes.copyPastTag.savedPositionSource = sourceCenter;
                    }
                    var origLinkTarget = link.attributes.target;
                    if (origLinkTarget && origLinkTarget.id) {
                        var boxT = this.paper.findViewByModel(this.graph.getCell(origLinkTarget.id)).getBBox();
                        var targetCenter = { x: boxT.x + boxT.width / 2, y: boxT.y + boxT.height }
                        link.attributes.copyPastTag.savedPositionTarget = targetCenter;
                    };
                });

                var clonedList = this.graph.cloneCells(selectedCellList);
                this.cloneCellList = $.map(clonedList, (value) => [value]);
                this.cloneCellList = _.sortBy(this.cloneCellList, item => (item.attributes.type === 'link' ? 2 : 1));
            }
        }

        public pastClonedCell = () => {
            var removeCellInCloneList = [];
            if (this.cloneCellList) {
                var clonedArray = this.graph.cloneCells(this.cloneCellList);
                clonedArray = $.map(clonedArray, value => [value]);
                clonedArray = _.sortBy(clonedArray, item => (item.attributes.type === 'link' ? 2 : 1));
                clonedArray.forEach((item) => {
                    this.initBeforePast(item);
                    item.translate(this.deltaMove, this.deltaMove);
                });

                //linkSource and mainFunction
                clonedArray.forEach((cell) => {
                    if (cell.attributes.copyPastTag.linkSource) {
                        cell.attributes.copyPastTag.linkSource.forEach((linkSourceItem) => {
                            var newLinkSourceEl = clonedArray.filter((ca) => { return ca.attributes.copyPastTag.jointId === linkSourceItem.id });
                            if (cell.attributes.linkSource == null) {
                                cell.attributes.linkSource = [];
                            }
                            if (newLinkSourceEl.length === 1) {
                                cell.attributes.linkSource.push({ id: newLinkSourceEl[0].id });
                            }

                        });
                    }

                    if (cell.attributes.copyPastTag.mainFunction) {
                        var mainFunction = cell.attributes.copyPastTag.mainFunction;
                        var newMainFunctionEl = clonedArray.filter((ca) => { return ca.attributes.copyPastTag.jointId === mainFunction.id });
                        if (newMainFunctionEl.length === 0) {
                            removeCellInCloneList.push(cell);
                        } else {
                            cell.attributes.mainFunction = { id: newMainFunctionEl[0].get(CellAttribute.modelId) }
                        }

                    }
                });

                clonedArray
                    .filter(clone => clone.isLink())
                    .forEach((clone) => {
                        var source = clone.get("source");
                        var sourceExistInClonedArray = source
                            && source.id
                            && clonedArray.filter((i) => { return clone.get("source") && i.id === clone.get("source").id }).length > 0;
                        if (source && source.id && !this.graph.getCell(clone.get("source")) && !sourceExistInClonedArray) {
                            clone.set("source", clone.attributes.copyPastTag.savedPositionSource);
                        }
                        var target = clone.get("target");
                        var targetExistInClonedArray = source
                            && target.id
                            && clonedArray.filter((i) => { return clone.get("target") && i.id === clone.get("target").id }).length > 0;
                        if (target && target.id && !this.graph.getCell(target) && !targetExistInClonedArray) {
                            clone.set("target", clone.attributes.copyPastTag.savedPositionTarget);
                        }
                        delete clone.attributes.copyPastTag;
                    });

                clonedArray.forEach((cell) => {
                    delete cell.attributes.copyPastTag;
                });

                removeCellInCloneList.forEach((cell) => {
                    clonedArray.splice(clonedArray.indexOf(cell), 1);
                });

                if (clonedArray.length > 0) {
                    this.jointHistoryService.batchOperationWithElementName(HistoryOperation.CloneGroup, "", () => {
                        clonedArray.forEach((cell) => {
                            this.graph.addCell(cell);
                            if (!cell.isLink() && !cell.get("parent")) {
                                JointRelationHelper.embedCell(cell, this.paper);
                            }
                        });
                    });
                    this.selectService.clear();
                    this.selectService.addRange(clonedArray);
                    this.selectService.selectCellListChanges();
                    this.deltaMove = this.deltaMove + this.paper.options.gridSize;
                    this.updateLabel();
                }

            }
        }
    }
}