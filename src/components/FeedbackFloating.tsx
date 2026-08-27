import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
export default function FeedbackFloating(){return <Pressable onPress={()=>router.push('/feedback')} style={s.button} accessibilityLabel="Give feedback"><Ionicons name="chatbubble-ellipses-outline" size={19} color="#0D0D0D"/><Text style={s.text}>Feedback</Text></Pressable>}
const s=StyleSheet.create({button:{position:'absolute',right:16,bottom:84,height:46,paddingHorizontal:15,borderRadius:23,backgroundColor:'#A8E63A',flexDirection:'row',alignItems:'center',gap:7,elevation:7,shadowColor:'#000',shadowOpacity:.16,shadowRadius:8,shadowOffset:{width:0,height:4},zIndex:999},text:{color:'#0D0D0D',fontSize:12,fontWeight:'800'}});