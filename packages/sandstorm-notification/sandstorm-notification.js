SandstormNotification = function SandstormNotification(title, options) {
    this.title = title;
    this.body = (options && options.body) || "";
    this.data = (options && options.data) || null;
    this.dir = (options && options.dir) || "auto";
    this.icon = (options && options.icon) || "";
    this.lang = (options && options.lang) || "";
    this.silent = (options && options.silent) || false;
    this.tag = (options && options.tag) || "";

    this._eventListeners = [];

    // Generate a random, hopefully unique ID for this notification
    var notificationId = String(Math.random());
    this._notificationId = notificationId;
    var req = {
      notificationCreate: {
        notificationId: notificationId,
        notificationArgs: {
          title: title,
          options: options
        }
      }
    };
    SandstormNotification._notifications[notificationId] = this;
    window.parent.postMessage(req, "*");
    return this;
}

// We need a way to connect notification IDs to SandstormNotification objects.
SandstormNotification._notifications = {};

// EventTarget interface implementation, as described in
// https://dom.spec.whatwg.org/#interface-eventtarget
SandstormNotification.prototype.addEventListener = function addEventListener(type, listener, useCapture) {
    if (listener === null) return;
    var shouldUseCapture = useCapture || false;
    for (var i = 0 ; i < this._eventListeners.length ; i++) {
        var existingListener = this._eventListener[i];
        if (existingListener.type === type &&
            existingListener.listerner === listener &&
            existingListener.useCapture === shouldUseCapture) {
            return;
        }
    }
    this._eventListeners.push({ type: type, listener: listener, useCapture: shouldUseCapture });
};

SandstormNotification.prototype.removeEventListener = function removeEventListener(type, listener, useCapture) {
    var shouldUseCapture = useCapture || false;
    for (var i = 0 ; i < this._eventListeners.length ; i++) {
        var existingListener = this._eventListener[i];
        if (existingListener.type === type &&
            existingListener.listerner === listener &&
            existingListener.useCapture === shouldUseCapture) {
            this._eventListeners.splice(i, 1);
            return;
        }
    }
};

SandstormNotification.prototype.dispatchEvent = function dispatchEvent(event) {
    // The user-agent would normally do this during initEvent, but we don't hook there, so we'll
    // do it here instead.
    event._stopPropagation = false;
    event._stopImmediatePropagation = false;
    event.stopPropagation = function stopPropagation() {
        event._stopPropagation = true;
    };
    event.stopImmediatePropagation = function stopImmediatePropagation() {
        event._stopPropagation = true;
        event._stopImmediatePropagation = true;
    };
    // section 3.6: item 1
    if (event._dispatch) {
        throw new InvalidStateError();
    }
    // section 3.6: item 2 skipped: user-agent has already set isTrusted to false
    // section 3.7: dispatching event
    // 1. (elided) event is already the event that is dispatched
    // 2. set dispatch flag
    event._dispatch = true;
    // 3. set target attribute.  Since event.target is not writable, we cheat.
    event.target = this;
    Object.defineProperty(event, "target", {__proto__: null, value: this, configurable: true});
    // 4. (elided) event path is empty, because SandstormNotification can't have child elements
    // 5. (elided) set eventPhase to CAPTURING_PHASE (skipped because 6 is skipped and 7 writes
    //             eventPhase again
    // 6. (elided) event path is empty, so this is a noop
    // 7. set eventPhase to AT_TARGET.  We can't redefine eventPhase (like we could with target
    // and currentTarget), so we just have to use a different variable and hope no one notices.
    //event.eventPhase = Event.AT_TARGET;
    Object.defineProperty(event, "eventPhase", {__proto__: null, value: Event.AT_TARGET, configurable: true});
    // 8. invoke event listeners of target if stop propagation flag unset.
    if (!event._stopPropagation) {
        // 1. (elided) let event be the event
        // 2. Let listeners be a copy of the event listeners
        var eventListenersCopy = this._eventListeners.slice(0);
        // Sandstorm hack: we don't get to intercept writes to this.onclick and this.onerror,
        // so if they're set, let's patch them in here.  This isn't a perfect simulation of
        // what other user-agents are supposed to do, but hopefully it's sufficient.
        if (this.onclick) {
            eventListenersCopy.push({ type: 'click', listener: this.onclick, useCapture: false, hack: true });
        }
        if (this.onerror) {
            eventListenersCopy.push({ type: 'error', listener: this.onerror, useCapture: false, hack: true });
        }

        // 3. Initialize event's currentTarget attribute.  Cheating again, because currentTarget
        // is not writable either.
        event.currentTarget = this;
        Object.defineProperty(event, "currentTarget", {__proto__: null, value: this, configurable: true});
        // 4. For each event listener, run 6 substeps:
        for (var i = 0; i < eventListenersCopy.length ; i++) {
            // 1. if stop immediate propagation flag set, terminate the invoke algorithm
            if (event._stopImmediatePropagation) break;
            // 2. let listener be the event listener.
            var listener = eventListenersCopy[i];
            // 3. if type attribute is not listeners's type, skip substeps and run for next
            // listener
            if (event.type !== listener.type) continue
            // 4. if phase is CAPTURING PHASE and capture is false, skip substeps and run for
            // next listener
            if (event.eventPhase === Event.CAPTURING_PHASE && listener.useCapture === false) continue;
            // 5. if phase is BUBBLING_PHASE and listener's capture is true, skip (the same...)
            if (event.eventPhase === Event.BUBBLING_PHASE && listener.useCapture === true) continue;
            // 6. Call listener's callback's handleEvent(), with the event passed to this
            // algorithm as the first argument and event's currentTarget attribute value as the
            // callback this value.  If this throws any exception, report the exception.
            var eventListener = listener.listener;
            // All Javascript Function objects automatically implement handleEvent by calling
            // the function.  But not from the JS API, so we implement this ourselves.
            var callback = eventListener.handleEvent || typeof(eventListener) === "function" ? eventListener : undefined;
            if (eventListener === "undefined") {
                continue;
            }
            var boundCallback = listener.hack ? callback.bind(window) : callback.bind(this);
            boundCallback(event);
        }
    }
    // 9. (elided) if event.bubbles, run substeps.  Elided because event path is always empty.
    // 10. Unset event's dispatch flag
    event._dispatch = undefined;
    // 11. set eventPhase to NONE
    Object.defineProperty(event, "eventPhase", {__proto__: null, value: Event.NONE, configurable: true});
    // 12. set currentTarget to null
    event.currentTarget = null;
    Object.defineProperty(event, "currentTarget", {__proto__: null, value: null, configurable: true});
    // 13 return false if event's canceled flag is set, true otherwise
    return !event.defaultPrevented;
};

SandstormNotification.prototype.close = function close() {
    var req = {
        notificationClose: {
            notificationId: this._notificationId
        }
    };
    window.parent.postMessage(req, "*");
};

// On load, client will postMessage() to shell to ask current permission.
// In event handler for reply, update cached value on global object.
SandstormNotification.permission = "default";
SandstormNotification._requestPermissionCallbacks = [];

SandstormNotification.requestPermission = function requestPermission(callback) {
    // We only ever need to have one of these away to the shell at a time.
    if (SandstormNotification._requestPermissionCallbacks.length == 0) {
        window.parent.postMessage({ notificationRequestPermission: { }}, "*");
    }
    SandstormNotification._requestPermissionCallbacks.push(callback);
};

SandstormNotification._onMessage = function _onMessage(event) {
    if (!event.data) {
        return;
    }

    if (event.data.notificationPermissionChanged) {
        // Update cached value.
        SandstormNotification.permission = event.data.notificationPermissionChanged.newValue;
        // Trigger any pending callbacks.
        for (var i = 0 ; i < SandstormNotification._requestPermissionCallbacks.length ; i++) {
            var callback = SandstormNotification._requestPermissionCallbacks[i];
            callback(SandstormNotification.permission);
        }
        // Clear the callback list.
        SandstormNotification._requestPermissionCallbacks = [];
    } else if (event.data.notificationClicked) {
        var notId = event.data.notificationClicked.notificationId;
        var not = SandstormNotification._notifications[notId];
        var fakeEvent = new Event("click");
        not.dispatchEvent(fakeEvent);
    } else if (event.data.notificationError) {
        var notId = event.data.notificationError.notificationId;
        var not = SandstormNotification._notifications[notId];
        var fakeEvent = new Event("error");
        not.dispatchEvent(fakeEvent);
    }
};

SandstormNotification.install = function install() {
    // Handle the various replies from the shell.
    window.addEventListener("message", SandstormNotification._onMessage, false);
    // Trigger an initial refresh of the cached permission state.
    window.parent.postMessage({notificationRefreshPermission: {}}, "*");
    // Save a copy of the real window.Notification.
    SandstormNotification._realNotification = window.Notification;
    // Okay, now we monkey patch the real Notification.
    window.Notification = SandstormNotification;
};
