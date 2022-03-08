// @flow

import debounce from 'lodash/debounce';

import { _handleParticipantError } from '../base/conference';
import { getSourceNameSignalingFeatureFlag } from '../base/config';
import { MEDIA_TYPE } from '../base/media';
import { getLocalParticipant, getParticipantCount } from '../base/participants';
import { StateListenerRegistry } from '../base/redux';
import { getTrackSourceNameByMediaTypeAndParticipant } from '../base/tracks';
import { reportError } from '../base/util';
import { shouldDisplayTileView } from '../video-layout';

import { setMaxReceiverVideoQuality } from './actions';
import { VIDEO_QUALITY_LEVELS } from './constants';
import { getReceiverVideoQualityLevel } from './functions';
import logger from './logger';
import { getMinHeightForQualityLvlMap } from './selector';

declare var APP: Object;

/**
 * Handles changes in the visible participants in the filmstrip. The listener is debounced
 * so that the client doesn't end up sending too many bridge messages when the user is
 * scrolling through the thumbnails prompting updates to the selected endpoints.
 */
StateListenerRegistry.register(
    /* selector */ state => state['features/filmstrip'].visibleRemoteParticipants,
    /* listener */ debounce((visibleRemoteParticipants, store) => {
        _updateReceiverVideoConstraints(store);
    }, 100));

StateListenerRegistry.register(
    /* selector */ state => state['features/base/tracks'],
    /* listener */(remoteTracks, store) => {
        _updateReceiverVideoConstraints(store);
    });

/**
 * Handles the use case when the on-stage participant has changed.
 */
StateListenerRegistry.register(
    state => state['features/large-video'].participantId,
    (participantId, store) => {
        _updateReceiverVideoConstraints(store);
    }
);

/**
 * Handles the use case when we have set some of the constraints in redux but the conference object wasn't available
 * and we haven't been able to pass the constraints to lib-jitsi-meet.
 */
StateListenerRegistry.register(
    state => state['features/base/conference'].conference,
    (conference, store) => {
        _updateReceiverVideoConstraints(store);
    }
);

/**
 * Updates the receiver constraints when the layout changes. When we are in stage view we need to handle the
 * on-stage participant differently.
 */
StateListenerRegistry.register(
    /* selector */ state => state['features/video-layout'].tileViewEnabled,
    /* listener */ (tileViewEnabled, store) => {
        _updateReceiverVideoConstraints(store);
    }
);

/**
 * StateListenerRegistry provides a reliable way of detecting changes to
 * lastn state and dispatching additional actions.
 */
StateListenerRegistry.register(
    /* selector */ state => state['features/base/lastn'].lastN,
    /* listener */ (lastN, store) => {
        _updateReceiverVideoConstraints(store);
    });

/**
 * StateListenerRegistry provides a reliable way of detecting changes to
 * maxReceiverVideoQuality and preferredVideoQuality state and dispatching additional actions.
 */
StateListenerRegistry.register(
    /* selector */ state => {
        const {
            maxReceiverVideoQuality,
            preferredVideoQuality
        } = state['features/video-quality'];

        return {
            maxReceiverVideoQuality,
            preferredVideoQuality
        };
    },
    /* listener */ (currentState, store, previousState = {}) => {
        const { maxReceiverVideoQuality, preferredVideoQuality } = currentState;
        const changedPreferredVideoQuality = preferredVideoQuality !== previousState.preferredVideoQuality;
        const changedReceiverVideoQuality = maxReceiverVideoQuality !== previousState.maxReceiverVideoQuality;

        if (changedPreferredVideoQuality) {
            _setSenderVideoConstraint(preferredVideoQuality, store);
            typeof APP !== 'undefined' && APP.API.notifyVideoQualityChanged(preferredVideoQuality);
        }
        changedReceiverVideoQuality && _updateReceiverVideoConstraints(store);
    }, {
        deepEquals: true
    });

/**
 * Implements a state listener in order to calculate max receiver video quality.
 */
StateListenerRegistry.register(
    /* selector */ state => {
        const { reducedUI } = state['features/base/responsive-ui'];
        const _shouldDisplayTileView = shouldDisplayTileView(state);
        const thumbnailSize = state['features/filmstrip']?.tileViewDimensions?.thumbnailSize;
        const participantCount = getParticipantCount(state);

        return {
            displayTileView: _shouldDisplayTileView,
            participantCount,
            reducedUI,
            thumbnailHeight: thumbnailSize?.height
        };
    },
    /* listener */ ({ displayTileView, participantCount, reducedUI, thumbnailHeight }, { dispatch, getState }) => {
        const state = getState();
        const { maxReceiverVideoQuality } = state['features/video-quality'];
        const { maxFullResolutionParticipants = 2 } = state['features/base/config'];

        let newMaxRecvVideoQuality = VIDEO_QUALITY_LEVELS.ULTRA;

        if (reducedUI) {
            newMaxRecvVideoQuality = VIDEO_QUALITY_LEVELS.LOW;
        } else if (displayTileView && !Number.isNaN(thumbnailHeight)) {
            newMaxRecvVideoQuality = getReceiverVideoQualityLevel(thumbnailHeight, getMinHeightForQualityLvlMap(state));

            // Override HD level calculated for the thumbnail height when # of participants threshold is exceeded
            if (maxReceiverVideoQuality !== newMaxRecvVideoQuality && maxFullResolutionParticipants !== -1) {
                const override
                    = participantCount > maxFullResolutionParticipants
                        && newMaxRecvVideoQuality > VIDEO_QUALITY_LEVELS.STANDARD;

                logger.info(`Video quality level for thumbnail height: ${thumbnailHeight}, `
                    + `is: ${newMaxRecvVideoQuality}, `
                    + `override: ${String(override)}, `
                    + `max full res N: ${maxFullResolutionParticipants}`);

                if (override) {
                    newMaxRecvVideoQuality = VIDEO_QUALITY_LEVELS.STANDARD;
                }
            }
        }

        if (maxReceiverVideoQuality !== newMaxRecvVideoQuality) {
            dispatch(setMaxReceiverVideoQuality(newMaxRecvVideoQuality));
        }
    }, {
        deepEquals: true
    });

/**
 * Helper function for updating the preferred sender video constraint, based on the user preference.
 *
 * @param {number} preferred - The user preferred max frame height.
 * @returns {void}
 */
function _setSenderVideoConstraint(preferred, { getState }) {
    const state = getState();
    const { conference } = state['features/base/conference'];

    if (!conference) {
        return;
    }

    logger.info(`Setting sender resolution to ${preferred}`);
    conference.setSenderVideoConstraint(preferred)
        .catch(error => {
            _handleParticipantError(error);
            reportError(error, `Changing sender resolution to ${preferred} failed.`);
        });
}

/**
 * Private helper to calculate the receiver video constraints and set them on the bridge channel.
 *
 * @param {*} store - The redux store.
 * @returns {void}
 */
function _updateReceiverVideoConstraints({ getState }) {
    const state = getState();
    const { conference } = state['features/base/conference'];

    if (!conference) {
        return;
    }
    const { lastN } = state['features/base/lastn'];
    const { maxReceiverVideoQuality, preferredVideoQuality } = state['features/video-quality'];
    const { participantId: largeVideoParticipantId } = state['features/large-video'];
    const maxFrameHeight = Math.min(maxReceiverVideoQuality, preferredVideoQuality);
    const { remoteScreenShares } = state['features/video-layout'];
    const { visibleRemoteParticipants } = state['features/filmstrip'];
    const tracks = state['features/base/tracks'];
    const sourceNameSignaling = getSourceNameSignalingFeatureFlag(state);
    const localParticipantId = getLocalParticipant(state)?.id;

    let receiverConstraints;

    if (sourceNameSignaling) {
        receiverConstraints = {
            constraints: {},
            defaultConstraints: { 'maxHeight': VIDEO_QUALITY_LEVELS.NONE },
            lastN,
            onStageSources: [],
            selectedSources: []
        };
        const visibleRemoteTrackSourceNames = [];
        let largeVideoSourceName;

        if (visibleRemoteParticipants?.size) {
            visibleRemoteParticipants.forEach(participantId => {
                const sourceName = getTrackSourceNameByMediaTypeAndParticipant(tracks, MEDIA_TYPE.VIDEO, participantId);

                if (sourceName) {
                    visibleRemoteTrackSourceNames.push(sourceName);
                }
            });
        }

        if (localParticipantId !== largeVideoParticipantId) {
            largeVideoSourceName = getTrackSourceNameByMediaTypeAndParticipant(
                tracks, MEDIA_TYPE.VIDEO,
                largeVideoParticipantId
            );
        }

        // Tile view.
        if (shouldDisplayTileView(state)) {
            if (!visibleRemoteTrackSourceNames?.length) {
                return;
            }

            visibleRemoteTrackSourceNames.forEach(sourceName => {
                receiverConstraints.constraints[sourceName] = { 'maxHeight': maxFrameHeight };
            });

            // Prioritize screenshare in tile view.
            if (remoteScreenShares?.length) {
                const remoteScreenShareSourceNames = remoteScreenShares.map(remoteScreenShare =>
                    getTrackSourceNameByMediaTypeAndParticipant(tracks, MEDIA_TYPE.VIDEO, remoteScreenShare)
                );

                receiverConstraints.selectedSources = remoteScreenShareSourceNames;
            }

        // Stage view.
        } else {
            if (!visibleRemoteTrackSourceNames?.length && !largeVideoSourceName) {
                return;
            }

            if (visibleRemoteTrackSourceNames?.length) {
                visibleRemoteTrackSourceNames.forEach(sourceName => {
                    receiverConstraints.constraints[sourceName] = { 'maxHeight': VIDEO_QUALITY_LEVELS.LOW };
                });
            }

            if (largeVideoSourceName) {
                receiverConstraints.constraints[largeVideoSourceName] = { 'maxHeight': maxFrameHeight };
                receiverConstraints.onStageSources = [ largeVideoSourceName ];
            }
        }

    } else {
        receiverConstraints = {
            constraints: {},
            defaultConstraints: { 'maxHeight': VIDEO_QUALITY_LEVELS.NONE },
            lastN,
            onStageEndpoints: [],
            selectedEndpoints: []
        };

        // Tile view.
        // eslint-disable-next-line no-lonely-if
        if (shouldDisplayTileView(state)) {
            if (!visibleRemoteParticipants?.size) {
                return;
            }

            visibleRemoteParticipants.forEach(participantId => {
                receiverConstraints.constraints[participantId] = { 'maxHeight': maxFrameHeight };
            });

            // Prioritize screenshare in tile view.
            remoteScreenShares?.length && (receiverConstraints.selectedEndpoints = remoteScreenShares);

        // Stage view.
        } else {
            if (!visibleRemoteParticipants?.size && !largeVideoParticipantId) {
                return;
            }

            if (visibleRemoteParticipants?.size > 0) {
                visibleRemoteParticipants.forEach(participantId => {
                    receiverConstraints.constraints[participantId] = { 'maxHeight': VIDEO_QUALITY_LEVELS.LOW };
                });
            }

            if (largeVideoParticipantId) {
                receiverConstraints.constraints[largeVideoParticipantId] = { 'maxHeight': maxFrameHeight };
                receiverConstraints.onStageEndpoints = [ largeVideoParticipantId ];
            }
        }
    }

    try {
        conference.setReceiverConstraints(receiverConstraints);
    } catch (error) {
        _handleParticipantError(error);
        reportError(error, `Failed to set receiver video constraints ${JSON.stringify(receiverConstraints)}`);
    }
}
