import { Platform, StyleSheet } from 'react-native';
import DeviceInfo from 'react-native-device-info';
export const colors = {
    primaryBtn: "#f95464",
    primaryBtn2: "#c935aeff",
    secondaryText: '#8d8d8d',
    gray1: "#e2e2e2ff",
    gray2: "#c4c4c4ff",

    error: '#ff0000',
    success: '#00ff00',
    warning: '#ff9900',
    info: '#1faaff',

    inputPlaceholder: '#999',
    sliderThumb: '#007AFF', // Blue thumb (iOS-like)
    sliderRail: '#E0E0E0', // Gray rail (inactive part)
    sliderRailSelected: '#007AFF', // Blue selected rail (active part)
};

//style sheet
const H_PADDING = 7;
export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingHorizontal: H_PADDING,
    },
    conainerScrollView: {
        paddingHorizontal: H_PADDING,
        position: 'relative'
    },
    input: {
        height: 43,
        borderColor: '#ccc',
        borderWidth: 1,
        marginBottom: 11,
        paddingHorizontal: 10,
        borderRadius: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        marginBottom: 10,
    },

    img: { width: "100%", height: "100%", aspectRatio: 1 },
    //
    //
    pressableButton: {
        borderRadius: 9,
        backgroundColor: colors.primaryBtn,
        marginVertical: 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 30,
    },
    pressableButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    //
    //
    peoples_floatbtn: {
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        paddingHorizontal: 5,
        borderWidth: 0.9,
        borderColor: '#4F8EF7',
    },


    card: {
        padding: 10,
        borderRadius: 12,
        borderWidth: 0.1,
        borderColor: "#606060fb",
        backgroundColor: "#fefefeff",
        // iOS shadow
        shadowColor: "#000",
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,

        // Android shadow
        elevation: 4,
    },

    peoples_bio_things: {
        flexDirection: "row", gap: 2,
        paddingHorizontal: 4,
        paddingVertical: 2, paddingRight: 6,
        alignItems: "center"
    },
    peoples_bio_things_t: {
        fontSize: 13, color: '#000000ff'
    },
    //
    //
    conversation_message_container: { flexDirection: 'row', alignItems: 'center' },
    conversation_nextUserMessage: { alignSelf: 'flex-start' },
    conversation_currentUserMessage: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
    conversation_messageBubble: {
        maxWidth: '70%',
        padding: 8,
        borderRadius: 10,
    },

    conversation_textInput: {
        flex: 1,
        fontSize: 16,
        paddingRight: 10,
        paddingVertical: 12,
        minHeight: 44,
        maxHeight: 100,
    },
    conversation_textInputContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f5',
        borderRadius: 20,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    conversation_sendButton: { marginLeft: 3, },
    conversation_avatar: { width: 40, height: 40, borderRadius: 40, marginRight: 5 },
    conversation_timestamp: { fontSize: 10, color: '#e0e0e0', marginTop: 4, textAlign: 'right' },
    conversation_messageText: { color: 'white', fontSize: 16 },
    //
    //
    editprofile_inputtitle: {
        paddingLeft: 5,
        fontSize: 13,
        color: "#505380ff",
        fontWeight: 700,
        letterSpacing: 1.2
    },
    editprofile_input: {
        fontSize: 14,
        textAlignVertical: "top",
        padding: 0, paddingLeft: 5, paddingVertical: 5, textTransform: "capitalize",
    },
    editprofile_inputborder: {
        borderColor: "#bbb",
        borderWidth: .4,
        padding: 3,
        borderRadius: 9
    },

    editProfile_box: { flex: 1, aspectRatio: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 10, overflow: "hidden" },

    editProfile_chip: {
        backgroundColor: '#ccd',
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 10,
        margin: 3,
    },
    editProfile_text: {
        color: '#000',
        fontSize: 12,
    },


    //
    //

    slider_thumb: {
        width: 16,
        height: 16,
        borderRadius: 15,
        backgroundColor: '#007AFF', // Blue thumb (iOS-like)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2, // Android shadow
    },
    slider_rail: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E0E0E0', // Gray rail (inactive part)
    },
    slider_railSelected: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#007AFF', // Blue selected rail (active part)
    },
    //
    //
    //
    zcircle1: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: 'rgba(255, 107, 139, 0.08)',
        top: -150,
        left: -100,
    },
    zcircle2: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 150,
        backgroundColor: 'rgba(100, 120, 255, 0.08)',
        bottom: -50,
        right: -50,
    },
    zcircle3: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 200, 100, 0.06)',
        top: '30%',
        right: -50,
    },
});

export const namer = {
    storage: {
        mapper_payload: 'cbvyshctds',
        sessionId: 'yksgiuw5ieytjgvc', //x-omi-auth
        sessionIdVerify: 'u4iek8r6uyfh', // authorization
        applog: 'fdgsdgn3t4gh',
        deviceSpecs: 'a54yregfdsg5534g',
        currentUserProfile: "b5rb5vt8euiynry",
        mapper:"dhgfhst4hj6h6h6",
        products: "j6yn65ik57y",
        themeMode: "pk3nf7vqxz8w2m"
    },
    navigation: {
        devpage: "zz_devv",
        peoples: "Peoples",
        social: "Communities",
        home:"Home",
        peoplesOnePerson: "Peoplesoneperson",
        chat: "Chats",
        conversation: "Conversation",
        likes: "Likes",
        profile: "Profile",
        settings: "Settings",
        editprofile: "Editprofile",
        editProfilePrompts: "EditProfilePrompts",
        editProfileInterests: "EditProfileInterests",
        editpreference: "Editpreference",
        signup: "signup",
        login: "login",
        subscription: "payments",
        consumables: "consumable",
    },
    productCategoryName: {
        mainsub: "mainsub",
        superlike: "superlike",
        instantmessage: "instantmessage",
        rewind: "rewind"
    },
}

export const resourceMap = {
    lottie: {
        pulsingLoading: require('../assets/lottie/pulsing.json'),
        infinityLoading: require('../assets/lottie/infinity.json'),
        heartpop: require('../assets/lottie/heartpop.json'),
    },
    loading1: require('../assets/images/loading1.gif'),
};

//
// remove for prod
export const __CONFIG__ = [
  {
    DOMAIN: "suyoapp.com",
    HTTPS_DOMAIN: "https://"+"suyoapp.com",

    API_DOMAIN: "api.suyoapp.com",
    HTTPS_API_DOMAIN: "https://"+"api.suyoapp.com",

    BRAND_NAME: "SuyoApp",
    SUPPORT_EMAIL: "support@suyoapp.com",
    SAFETY_EMAIL: "safety@suyoapp.com",
  },
  {
    DOMAIN: "10.0.2.2:2004",
    HTTPS_DOMAIN: "http://"+"10.0.2.2:2004",

    API_DOMAIN: "10.0.2.2:2001",
    HTTPS_API_DOMAIN: "http://"+"10.0.2.2:2001",

    BRAND_NAME: "SuyoApp",
    SUPPORT_EMAIL: "support@suyoapp.com",
    SAFETY_EMAIL: "safety@suyoapp.com",
  }
// remove on prod
][(DeviceInfo.isEmulatorSync() && Platform.OS === "android") ? 1 : 0];