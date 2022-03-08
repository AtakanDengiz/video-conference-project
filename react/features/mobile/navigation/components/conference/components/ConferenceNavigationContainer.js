// @flow

import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { Chat } from '../../../../../chat';
import Conference from '../../../../../conference/components/native/Conference';
import { getDisablePolls } from '../../../../../conference/functions';
import { SharedDocument } from '../../../../../etherpad';
import AddPeopleDialog
    from '../../../../../invite/components/add-people-dialog/native/AddPeopleDialog';
import LobbyScreen from '../../../../../lobby/components/native/LobbyScreen';
import { ParticipantsPane } from '../../../../../participants-pane/components/native';
import { StartLiveStreamDialog } from '../../../../../recording';
import { StartRecordingDialog }
    from '../../../../../recording/components/Recording/native';
import SalesforceLinkDialog
    from '../../../../../salesforce/components/native/SalesforceLinkDialog';
import SecurityDialog
    from '../../../../../security/components/security-dialog/native/SecurityDialog';
import SpeakerStats
    from '../../../../../speaker-stats/components/native/SpeakerStats';
import { screen } from '../../../routes';
import {
    chatScreenOptions,
    conferenceScreenOptions,
    inviteScreenOptions,
    liveStreamScreenOptions,
    lobbyScreenOptions,
    navigationContainerTheme,
    participantsScreenOptions,
    recordingScreenOptions,
    salesforceScreenOptions,
    securityScreenOptions,
    sharedDocumentScreenOptions,
    speakerStatsScreenOptions
} from '../../../screenOptions';
import ChatAndPollsNavigationContainer
    from '../../chat/components/ChatAndPollsNavigationContainer';
import {
    conferenceNavigationRef, setParams
} from '../ConferenceNavigationContainerRef';

import CarmodeTab from '../../../../../conference/components/native/CarmodeTab';

const ConferenceStack = createStackNavigator();
const ConferenceTabs = createMaterialTopTabNavigator();

const ConferenceNavigationContainer = () => {
    const isPollsDisabled = useSelector(getDisablePolls);
    let ChatScreen;
    let chatScreenName;
    let chatTitleString;

    if (isPollsDisabled) {
        ChatScreen = Chat;
        chatScreenName = screen.conference.chat;
        chatTitleString = 'chat.title';
    } else {
        ChatScreen = ChatAndPollsNavigationContainer;
        chatScreenName = screen.conference.chatandpolls.main;
        chatTitleString = 'chat.titleWithPolls';
    }
    const { t } = useTranslation();

    return (
        <SafeAreaProvider>
            <NavigationContainer
                independent = { true }
                ref = { conferenceNavigationRef }
                theme = { navigationContainerTheme }>
                <ConferenceTabs.Navigator
                    activeColor = '#e91e63'
                    tabBarOptions = {{
                        style: {
                            display: 'none'
                        }
                    }}>

                    <ConferenceTabs.Screen
                        name = { screen.conference.container } >
                        {() => (
                            <ConferenceStack.Navigator
                                initialRouteName = { screen.conference.main }
                                screenOptions = {{
                                    presentation: 'modal'
                                }}>
                                <ConferenceStack.Screen
                                    component = { Conference }
                                    name = { screen.conference.main }
                                    options = { conferenceScreenOptions } />
                                <ConferenceStack.Screen
                                    component = { ChatScreen }
                                    name = { chatScreenName }
                                    options = {{
                                        ...chatScreenOptions,
                                        title: t(chatTitleString)
                                    }} />
                                <ConferenceStack.Screen
                                    component = { ParticipantsPane }
                                    name = { screen.conference.participants }
                                    options = {{
                                        ...participantsScreenOptions,
                                        title: t('participantsPane.header')
                                    }} />
                                <ConferenceStack.Screen
                                    component = { SecurityDialog }
                                    name = { screen.conference.security }
                                    options = {{
                                        ...securityScreenOptions,
                                        title: t('security.header')
                                    }} />
                                <ConferenceStack.Screen
                                    component = { StartRecordingDialog }
                                    name = { screen.conference.recording }
                                    options = {{
                                        ...recordingScreenOptions
                                    }} />
                                <ConferenceStack.Screen
                                    component = { StartLiveStreamDialog }
                                    name = { screen.conference.liveStream }
                                    options = {{
                                        ...liveStreamScreenOptions
                                    }} />
                                <ConferenceStack.Screen
                                    component = { SpeakerStats }
                                    name = { screen.conference.speakerStats }
                                    options = {{
                                        ...speakerStatsScreenOptions,
                                        title: t('speakerStats.speakerStats')
                                    }} />
                                <ConferenceStack.Screen
                                    component = { SalesforceLinkDialog }
                                    name = { screen.conference.salesforce }
                                    options = {{
                                        ...salesforceScreenOptions,
                                        title: t('notify.linkToSalesforce')
                                    }} />
                                <ConferenceStack.Screen
                                    component = { LobbyScreen }
                                    name = { screen.lobby }
                                    options = { lobbyScreenOptions } />
                                <ConferenceStack.Screen
                                    component = { AddPeopleDialog }
                                    name = { screen.conference.invite }
                                    options = {{
                                        ...inviteScreenOptions,
                                        title: t('addPeople.add')
                                    }} />
                                <ConferenceStack.Screen
                                    component = { SharedDocument }
                                    name = { screen.conference.sharedDocument }
                                    options = {{
                                        ...sharedDocumentScreenOptions,
                                        title: t('documentSharing.title')
                                    }} />
                            </ConferenceStack.Navigator>
                        )}
                    </ConferenceTabs.Screen>
                    <ConferenceTabs.Screen
                        component = { CarmodeTab }
                        headerShown = { false }
                        name = { screen.car } />
                </ConferenceTabs.Navigator>
            </NavigationContainer>
        </SafeAreaProvider >
    );
};

export default ConferenceNavigationContainer;
