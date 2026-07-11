const LERP = 0.2;

export class Camera {
    constructor(pContainerElement, pContentElement, pOptions = {}) {
        this.container = pContainerElement;
        this.content = pContentElement;
        
        // optional callback for when the user starts interacting (panning/zooming)
        this.onInteract = pOptions.onInteract || (() => {});

        //#region CAMERA STATE
        
        // current render state
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;

        this.targetScale = 1;
        this.targetTranslateX = 0;
        this.targetTranslateY = 0;

        this.isAnimating = false;

        // drag state
        this.isDragging = false;
        this.hasDragged = false; // Exposed so external clicks can check it
        this.startX = 0;
        this.startY = 0;
        
        // touch state tracking
        this.initialPinchDistance = null;

        //#endregion

        this.content.style.transformOrigin = "0 0";
        this.initControls();
    }



    // force the camera to a specific translation and zoom
    moveTo(pX, pY, pScale) {
        this.targetTranslateX = pX;
        this.targetTranslateY = pY;
        this.targetScale = pScale;
    }

    // instantly snap the view to the center of the content
    centerView(pOffsetX = 0, pOffsetY = 0) {
        const centerX = (this.container.clientWidth - this.content.offsetWidth) / 2;
        const centerY = (this.container.clientHeight - this.content.offsetHeight) / 2;
        
        this.moveTo(centerX + pOffsetX, centerY + pOffsetY, 1);
        
        // snap immediately without lerp
        this.translateX = this.targetTranslateX;
        this.translateY = this.targetTranslateY;
        this.scale = this.targetScale;
    }



    //#region CAMERA CONTROLS
    
    initControls() {
        // zoom (mouse)
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const oldScale = this.targetScale;
            const zoomSensitivity = 0.2;
            const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
            this.targetScale += delta;
            
            this.targetScale = Math.max(0.15, Math.min(this.targetScale, 3)); 
            
            // calculate scale ratio to adjust position
            const scaleRatio = this.targetScale / oldScale;

            // transform so zoom goes towards cursor
            const mouseX = e.clientX - this.container.getBoundingClientRect().left;
            const mouseY = e.clientY - this.container.getBoundingClientRect().top;
            
            this.targetTranslateX = mouseX - (mouseX - this.targetTranslateX) * scaleRatio;
            this.targetTranslateY = mouseY - (mouseY - this.targetTranslateY) * scaleRatio;

            this.onInteract();
        }, { passive: false });

        // pan start (mouse)
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.hasDragged = false;
            this.container.style.cursor = "grabbing";
            
            this.startX = e.clientX - this.targetTranslateX;
            this.startY = e.clientY - this.targetTranslateY;

            this.onInteract();
        });

        // pan move (mouse)
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.hasDragged = true;
            e.preventDefault();
            
            this.targetTranslateX = e.clientX - this.startX;
            this.targetTranslateY = e.clientY - this.startY;
        });

        // pan end (mouse)
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.container.style.cursor = "grab";
        });


        // touch start (mobile)
        this.container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                // single touch: pan
                this.isDragging = true;
                this.hasDragged = false;
                this.startX = e.touches[0].clientX - this.targetTranslateX;
                this.startY = e.touches[0].clientY - this.targetTranslateY;
            } else if (e.touches.length === 2) {
                // two touches: pinch zoom
                this.isDragging = false; 
                this.initialPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
            this.onInteract();
        }, { passive: false });

        // touch move (mobile)
        this.container.addEventListener('touchmove', (e) => {
            this.hasDragged = true;
            e.preventDefault(); 
            
            if (this.isDragging && e.touches.length === 1) {
                // handle pan
                this.targetTranslateX = e.touches[0].clientX - this.startX;
                this.targetTranslateY = e.touches[0].clientY - this.startY;
                
            } else if (e.touches.length === 2 && this.initialPinchDistance) {
                // handle pinch zoom
                const currentDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );

                const containerRect = this.container.getBoundingClientRect();

                // get middle point between the two fingers
                const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - containerRect.left;
                const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - containerRect.top;

                const oldScale = this.targetScale;

                // apply scale based on finger spread
                let newScale = oldScale * (currentDistance / this.initialPinchDistance);
                this.targetScale = Math.max(0.3, Math.min(newScale, 3));

                const scaleRatio = this.targetScale / oldScale;

                // adjust transform to center zoom on the midpoint
                this.targetTranslateX = centerX - (centerX - this.targetTranslateX) * scaleRatio;
                this.targetTranslateY = centerY - (centerY - this.targetTranslateY) * scaleRatio;

                // update for next move frame
                this.initialPinchDistance = currentDistance;
            }
            
        }, { passive: false });


        // touch end (mobile)
        this.container.addEventListener('touchend', (e) => {
            if (e.touches.length === 0) {
                this.isDragging = false;
                this.initialPinchDistance = null;
            } else if (e.touches.length === 1) {
                // if player drops one finger but keep one down, revert to panning
                this.isDragging = true;
                this.startX = e.touches[0].clientX - this.targetTranslateX;
                this.startY = e.touches[0].clientY - this.targetTranslateY;
            }
        });
    }

    //#endregion
    
    
    startLoop() {
        if (!this.isAnimating) {
            this.isAnimating = true;
            this.updateTransform();
        }
    }

    updateTransform() {
        requestAnimationFrame(() => this.updateTransform());
        
        // glide actual values toward targets
        this.scale += (this.targetScale - this.scale) * LERP;
        this.translateX += (this.targetTranslateX - this.translateX) * LERP;
        this.translateY += (this.targetTranslateY - this.translateY) * LERP;

        // update dom
        if (this.content) {
            this.content.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.scale})`;
        }
    }
}