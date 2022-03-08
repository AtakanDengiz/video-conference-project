import React from 'react';
import { Text } from 'react-native';
import { Container, LoadingIndicator, TintedView } from '../../../base/react';
import styles from './styles';
import { NativeModules, SafeAreaView, StatusBar, View } from 'react-native';
import ConferenceTimer from '../ConferenceTimer';
import { connect } from '../../../base/redux';
import { withSafeAreaInsets } from 'react-native-safe-area-context';
import { isToolboxVisible } from '../../../toolbox/functions';
import TitleBar from './TitleBar';

const CarmodeTab = ({_toolboxVisible}) => (
    <Container style={styles.conference}>
        <SafeAreaView pointerEvents = 'box-none'
                    style = { styles.titleBarSafeViewColor }>
            <View style={ styles.carmodeTitleView}>
                <Text style={styles.carmodeTitle}>Safe driving mode</Text>
            </View>
            <TitleBar _createOnPress = { () => {} } />
            <ConferenceTimer textStyle = { styles.roomTimer }/>
        </SafeAreaView>
    </Container>
);

/**
* Maps (parts of) the redux state to the associated {@code Conference}'s props.
*
* @param {Object} state - The redux state.
* @private
* @returns {Props}
*/
function _mapStateToProps(state) {
   const { connecting, connection } = state['features/base/connection'];
   const {
       conference,
       joining,
       membersOnly,
       leaving
   } = state['features/base/conference'];
   const { isOpen } = state['features/participants-pane'];
   const { aspectRatio, reducedUI } = state['features/base/responsive-ui'];

   // XXX There is a window of time between the successful establishment of the
   // XMPP connection and the subsequent commencement of joining the MUC during
   // which the app does not appear to be doing anything according to the redux
   // state. In order to not toggle the _connecting props during the window of
   // time in question, define _connecting as follows:
   // - the XMPP connection is connecting, or
   // - the XMPP connection is connected and the conference is joining, or
   // - the XMPP connection is connected and we have no conference yet, nor we
   //   are leaving one.
   const connecting_
       = connecting || (connection && (!membersOnly && (joining || (!conference && !leaving))));

   return {
       _aspectRatio: aspectRatio,
       _connecting: Boolean(connecting_),
       _isParticipantsPaneOpen: isOpen,
       _largeVideoParticipantId: state['features/large-video'].participantId,
       _reducedUI: reducedUI,
       _toolboxVisible: isToolboxVisible(state)
   };
}

export default withSafeAreaInsets(connect(_mapStateToProps)(CarmodeTab));
