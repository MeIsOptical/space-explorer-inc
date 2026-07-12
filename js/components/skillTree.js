

import { Camera } from "./camera.js";
import { updateXpBarUI } from "../utils/ui.js";
import { RUN_CONFIG } from "../main.js";
import { playSound, SOUND_IDS } from "../systems/audio.js";




export class SkillTree {
    constructor(pPlayer) {
        this.player = pPlayer;
        this.manifest = {}; 
        
        this.unlockedNodes = []; 

        this.camera = null;
    }



    async build() {
        const response = await fetch("assets/skillTree/manifest.json");
        this.manifest = await response.json();
    }




    hasSkill(pId) {
        return this.unlockedNodes.includes(pId);
    }




    canUnlock(pId) {
        const nodeData = this.manifest[pId];
        if (!nodeData) return false;

        for (const reqId of nodeData.requires) {
            if (!this.hasSkill(reqId)) {
                return false; 
            }
        }

        return true; 
    }


    nodePrice(pId) {

        if (RUN_CONFIG.dev) return 0;

        const nodeData = this.manifest[pId];
        const cost = BigInt(nodeData.cost)
        
        if (this.player.levelPts >= cost) {
            return cost;
        }
        return false;
    }


    unlockNode(pId) {
        const nodeData = this.manifest[pId];
        
        if (!RUN_CONFIG.dev) if (!nodeData || !this.canUnlock(pId) || this.hasSkill(pId)) return false;

        const confirmCost = this.nodePrice(pId);
        if (confirmCost !== false) {
            if (!RUN_CONFIG.dev) this.player.levelPts -= confirmCost;
            this.unlockedNodes.push(pId);
            
            return true; 
        }

        return false;
    }





    // groups active bonuses from unlocked skills
    getStatBonuses() {
        const totals = {};

        this.unlockedNodes.forEach(skillId => {
            const nodeData = this.manifest[skillId];
            
            if (nodeData && nodeData.skills) {
                nodeData.skills.forEach(skillDef => {
                    if (totals[skillDef.type] === undefined) {
                        totals[skillDef.type] = 0;
                    }
                    totals[skillDef.type] += skillDef.value;
                });
            }
        });

        return totals;
    }












    displayUI() {
        const nodesContainer = document.getElementById("skillTreeNodes");
        const linesContainer = document.getElementById("skillTreeLines");
        if (!nodesContainer || !linesContainer) return;

        // cache
        if (nodesContainer.children.length > 0) {
            const allNodes = document.querySelectorAll(".skillNode");
            allNodes.forEach(node => node.classList.remove("selected"));
            this.updateLiveUI();
            return;
        }

        nodesContainer.innerHTML = "";
        linesContainer.innerHTML = "";

        this.nodeCoords = {}; 
        const radiusStep = 110; 

        const nodeIds = Object.keys(this.manifest);
        const roots = nodeIds.filter(id => !this.manifest[id].requires || this.manifest[id].requires.length === 0);

        // pass 1: calculate branches weights
        const nodeWeights = {};
        const calculateWeight = (pNodeId) => {
            if (nodeWeights[pNodeId]) return nodeWeights[pNodeId];

            const children = nodeIds.filter(id => 
                this.manifest[id].requires && 
                this.manifest[id].requires[0] === pNodeId
            );

            if (children.length === 0) {
                nodeWeights[pNodeId] = 1;
                return 1;
            }

            let weight = 0;
            children.forEach(childId => {
                weight += calculateWeight(childId);
            });

            nodeWeights[pNodeId] = weight;
            return weight;
        };

        roots.forEach(rootId => calculateWeight(rootId));

        // pass 2: local vector placement
        const assignCoords = (pNodeId, pDepth, pX, pY, pAngle, pSpread) => {
            // place relative to its parent's position and trajectory
            if (pDepth === 0) {
                this.nodeCoords[pNodeId] = { x: 0, y: 0 };
            } else {
                this.nodeCoords[pNodeId] = {
                    x: pX + radiusStep * Math.cos(pAngle),
                    y: pY + radiusStep * Math.sin(pAngle)
                };
            }

            const children = nodeIds.filter(id => 
                this.manifest[id].requires && 
                this.manifest[id].requires[0] === pNodeId
            );

            if (children.length > 0) {
                const totalWeight = children.reduce((sum, id) => sum + nodeWeights[id], 0);
                
                let currentStart = pAngle - (pSpread / 2);

                children.forEach(childId => {
                    const slice = (nodeWeights[childId] / totalWeight) * pSpread;
                    const childAngle = currentStart + slice / 2;
                    
                    const nextSpread = children.length === 1 ? slice : slice * 1.42;
            
                    assignCoords(
                        childId, 
                        pDepth + 1, 
                        this.nodeCoords[pNodeId].x, 
                        this.nodeCoords[pNodeId].y, 
                        childAngle, 
                        nextSpread
                    );
                    currentStart += slice;
                });
            }
        };

        roots.forEach((rootId, i) => {
            const rootSpread = (Math.PI * 2) / roots.length;
            const rootAngle = (i * rootSpread) + (rootSpread / 2);
            assignCoords(rootId, 0, 0, 0, rootAngle, rootSpread);
        });


        // pass 3: realign convergent nodes
        nodeIds.forEach(id => {
            const node = this.manifest[id];
            
            // only apply to nodes with multiple requirements
            if (node.requires && node.requires.length > 1) {
                const parents = [];

                node.requires.forEach(reqId => {
                    if (this.nodeCoords[reqId]) {
                        parents.push(this.nodeCoords[reqId]);
                    }
                });

                if (parents.length === 2) {
                    const p1 = parents[0];
                    const p2 = parents[1];
                    
                    const oldX = this.nodeCoords[id].x;
                    const oldY = this.nodeCoords[id].y;

                    // find exact midpoint
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;

                    const dx = p2.x - p1.x;
                    const dy = p2.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist === 0) return; 

                    let perpX = -dy / dist;
                    let perpY = dx / dist;

                    // ensure the vector points forwards
                    const outX = oldX - midX;
                    const outY = oldY - midY;
                    const dotProduct = (perpX * outX) + (perpY * outY);

                    if (dotProduct < 0) {
                        perpX = -perpX;
                        perpY = -perpY;
                    }

                    const halfDist = dist / 2;
                    let height = radiusStep; 
                    
                    if (halfDist > radiusStep * 0.5) {
                        height = radiusStep;
                    } else {
                        height = Math.sqrt((radiusStep * radiusStep) - (halfDist * halfDist));
                    }

                    // assign coordinates
                    const newX = midX + (perpX * height);
                    const newY = midY + (perpY * height);

                    // update angle
                    const outAngle = Math.atan2(perpY, perpX);
                    const firstParent = this.nodeCoords[node.requires[0]];
                    const oldAngle = Math.atan2(oldY - firstParent.y, oldX - firstParent.x);
                    const rotation = outAngle - oldAngle;

                    this.nodeCoords[id] = { x: newX, y: newY };
                    
                    const rotateAndShift = (targetId) => {
                        const children = nodeIds.filter(childId => 
                            this.manifest[childId].requires && 
                            this.manifest[childId].requires[0] === targetId
                        );
                        
                        children.forEach(childId => {
                            const cx = this.nodeCoords[childId].x;
                            const cy = this.nodeCoords[childId].y;

                            const vx = cx - oldX;
                            const vy = cy - oldY;

                            const rx = (vx * Math.cos(rotation)) - (vy * Math.sin(rotation));
                            const ry = (vx * Math.sin(rotation)) + (vy * Math.cos(rotation));

                            this.nodeCoords[childId].x = newX + rx;
                            this.nodeCoords[childId].y = newY + ry;

                            rotateAndShift(childId);
                        });
                    };
                    
                    rotateAndShift(id);
                } 
            }
        });



        // generate the nodes
        nodeIds.forEach(id => {
            const node = this.manifest[id];
            const pos = this.nodeCoords[id];
            
            const btn = document.createElement("button");
            btn.className = "btn square skillNode";
            btn.id = `skillNode-${id}`;
            
            btn.style.left = `calc(${pos.x}px - (var(--node-size) / 2))`;
            btn.style.top = `calc(${pos.y}px - (var(--node-size) / 2))`;

            const icon = document.createElement("img");
            icon.src = `assets/ui/icons/${node.icon}.png`;
            icon.className = "btnIcon";
            btn.appendChild(icon);

            btn.addEventListener("click", () => {
                if (this.camera.hasDragged) return; 
                this.showPopup(id);
                playSound(SOUND_IDS.skillNodeOpen);
            });
            nodesContainer.appendChild(btn);
        });

        if (!this.camera) {
            const area = document.getElementById("skillTreeArea");
            const pan = document.getElementById("skillTreePan");
            
            this.camera = new Camera(area, pan, {
                onInteract: () => {
                    document.getElementById("skillPopup").classList.remove("show");
                    
                    const allNodes = document.querySelectorAll(".skillNode");
                    allNodes.forEach(node => node.classList.remove("selected"));
                }
            });
            
            this.camera.centerView();
            this.camera.startLoop();
        }

        this.updateLiveUI();
    }








    showPopup(pId) {
        const node = this.manifest[pId];
        if (!node) return;

        // handle visual selection
        const allNodes = document.querySelectorAll(".skillNode");
        allNodes.forEach(n => n.classList.remove("selected"));
        
        const selectedBtn = document.getElementById(`skillNode-${pId}`);
        if (selectedBtn) selectedBtn.classList.add("selected");


        const popup = document.getElementById("skillPopup");
        document.getElementById("skillPopupName").innerText = node.name.toUpperCase();
        document.getElementById("skillPopupDesc").innerText = node.description;
        
        const btn = document.getElementById("skillPopupBtn");

        if (this.hasSkill(pId)) {
            btn.style.display = "flex";
            btn.innerText = "UNLOCKED";
            btn.style.opacity = 0.4;
            btn.onclick = () => {
                playSound(SOUND_IDS.fail);
            };
        } else {
            btn.style.display = "flex";
            btn.innerText = `UNLOCK: ${node.cost} ${node.cost === 1 ? "Point" : "Points"}`;
            
            if (!this.canUnlock(pId) || this.nodePrice(pId) === false) {
                btn.style.opacity = 0.4;
                if (!this.canUnlock(pId)) btn.innerText += " (Locked)";
                btn.onclick = () => {
                    playSound(SOUND_IDS.fail);
                };
            } else {
                btn.disabled = false;
                btn.style.opacity = 1;
                btn.onclick = () => {
                    if (this.unlockNode(pId)) {
                        allNodes.forEach(n => n.classList.remove("selected"));
                        popup.classList.remove("show");
                        this.updateLiveUI();
                        updateXpBarUI(this.player);
                        playSound(SOUND_IDS.skillUnlock);
                    }
                    else {
                        playSound(SOUND_IDS.fail);
                    }
                };
            }
        }

        popup.classList.add("show");
    }









    // updates point counts and node colors without rebuilding everything
    updateLiveUI() {
        const ptsElement = document.getElementById("skillPtsAmount");
        if (!ptsElement) return;

        // update point counter
        ptsElement.innerText = this.player.levelPts;

        // update node states smoothly
        Object.keys(this.manifest).forEach(id => {
            const btn = document.getElementById(`skillNode-${id}`);
            if (btn) {
                if (this.hasSkill(id)) {
                    // visually unlock the node and remove affordability glow
                    btn.classList.add("unlocked");
                    btn.classList.remove("affordable");
                } else {
                    if (this.canUnlock(id) && this.nodePrice(id) !== false) {
                        btn.classList.add("affordable");
                    } else {
                        btn.classList.remove("affordable");
                    }
                }
            }
        });

        // dynamically update SVG lines
        if (this.nodeCoords) {
            const linesContainer = document.getElementById("skillTreeLines");
            if (linesContainer) {
                let svgContent = "";
                Object.keys(this.manifest).forEach(id => {
                    const node = this.manifest[id];
                    if (node.requires) {
                        node.requires.forEach(reqId => {
                            const start = this.nodeCoords[reqId];
                            const end = this.nodeCoords[id];
                            if (start && end) {
                                let color;
                                if (this.hasSkill(id)) {
                                    color = "var(--c-skill)";
                                } else if (this.hasSkill(reqId)) {
                                    color = "var(--c-skill-unlockable)"; 
                                } else {
                                    color = "var(--c-skill-locked)";
                                }
                                svgContent += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${color}" stroke-width="4" />`;
                            }
                        });
                    }
                });
                linesContainer.innerHTML = svgContent;
            }
        }

        // if a popup is currently open, refresh it
        const popup = document.getElementById("skillPopup");
        if (popup && popup.classList.contains("show")) {
            const selectedBtn = document.querySelector(".skillNode.selected");
            if (selectedBtn) {
                const nodeId = selectedBtn.id.replace("skillNode-", "");
                this.showPopup(nodeId); 
            }
        }
    }
}