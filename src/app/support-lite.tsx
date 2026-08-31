import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Ticket = { id: string; title: string; description: string; status: 'open' | 'in_progress' | 'resolved' | 'closed'; issue_type: string | null; created_at: string };

const statusLabel = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' } as const;

export default function SupportLite() {
  const router = useRouter();
  const [riderId, setRiderId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProblem, setShowProblem] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/(auth)/login' as any); return; }
      const { data: rider, error: riderError } = await supabase.from('riders').select('id').eq('auth_user_id', user.id).maybeSingle();
      if (riderError) throw riderError;
      if (!rider) throw new Error('Rider profile could not be found.');
      setRiderId(rider.id);
      const { data, error } = await supabase.from('rider_support_tickets').select('id,title,description,status,issue_type,created_at').eq('rider_id', rider.id).order('created_at', { ascending: false });
      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (error: any) {
      console.error('Rider support load failed:', error);
      Alert.alert('Unable to load support', error?.message || 'Please try again later.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTickets(); }, []);

  const submitProblem = async () => {
    if (!riderId || submitting) return;
    if (!title.trim()) { Alert.alert('Title required', 'Please enter a short problem title.'); return; }
    if (description.trim().length < 5) { Alert.alert('Description required', 'Please describe the problem.'); return; }
    try {
      setSubmitting(true);
      const { error } = await supabase.from('rider_support_tickets').insert({ rider_id: riderId, title: title.trim(), description: description.trim(), status: 'open', priority: 'medium', issue_type: 'problem', unread_for_admin: true });
      if (error) throw error;
      setTitle(''); setDescription(''); setShowProblem(false); await loadTickets();
      Alert.alert('Problem reported', 'Your report has been sent to Rivo support.');
    } catch (error: any) {
      console.error('Rider problem report failed:', error);
      Alert.alert('Unable to report problem', error?.message || 'Please try again later.');
    } finally { setSubmitting(false); }
  };

  const contact = async () => {
    const url = 'mailto:support@rivocity.com';
    try { if (await Linking.canOpenURL(url)) await Linking.openURL(url); else Alert.alert('Contact Support', 'Email support@rivocity.com'); }
    catch { Alert.alert('Contact Support', 'Email support@rivocity.com'); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} color="#FFFFFF" /></Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text><View style={styles.spacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><Ionicons name="headset-outline" size={24} color="#A8E63A" /></View>
          <Text style={styles.heroTitle}>Rivo Rider Support</Text>
          <Text style={styles.heroText}>Send feedback, report a problem, or contact the Rivo support team.</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => router.push('/feedback' as any)} style={styles.actionCard}>
            <View style={styles.actionIcon}><Ionicons name="star-outline" size={22} color="#A8E63A" /></View>
            <Text style={styles.actionTitle}>Send Feedback</Text><Text style={styles.actionText}>Rate your Rider app experience.</Text>
          </Pressable>
          <Pressable onPress={() => setShowProblem(v => !v)} style={styles.actionCard}>
            <View style={styles.problemIcon}><Ionicons name="flag-outline" size={22} color="#F87171" /></View>
            <Text style={styles.actionTitle}>Report a Problem</Text><Text style={styles.actionText}>Tell us about an issue.</Text>
          </Pressable>
        </View>
        {showProblem && <View style={styles.form}>
          <Text style={styles.formTitle}>Report a Problem</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Problem title" placeholderTextColor="#737373" style={styles.input} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Describe the problem..." placeholderTextColor="#737373" multiline textAlignVertical="top" style={[styles.input, styles.textarea]} />
          <View style={styles.formActions}><Pressable onPress={() => setShowProblem(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable onPress={submitProblem} disabled={submitting} style={styles.submit}>{submitting ? <ActivityIndicator size="small" color="#0D0D0D" /> : <Ionicons name="send-outline" size={17} color="#0D0D0D" />}<Text style={styles.submitText}>{submitting ? 'Sending...' : 'Submit'}</Text></Pressable></View>
        </View>}
        <Pressable onPress={contact} style={styles.contact}><View style={styles.contactIcon}><Ionicons name="mail-outline" size={20} color="#A8E63A" /></View><View style={styles.contactText}><Text style={styles.contactLabel}>Contact Us</Text><Text style={styles.contactValue}>support@rivocity.com</Text></View><Ionicons name="chevron-forward" size={19} color="#737373" /></Pressable>
        <View style={styles.section}><Text style={styles.sectionTitle}>My Support Requests</Text><Text style={styles.count}>{tickets.length}</Text></View>
        {loading ? <View style={styles.loading}><ActivityIndicator color="#A8E63A" /></View> : tickets.length === 0 ? <View style={styles.empty}><Ionicons name="documents-outline" size={28} color="#525252" /><Text style={styles.emptyTitle}>No support requests</Text><Text style={styles.emptyText}>Problem reports you submit will appear here.</Text></View> : tickets.map(ticket => <View key={ticket.id} style={styles.ticket}><View style={styles.ticketTop}><View style={styles.ticketMain}><Text style={styles.ticketTitle} numberOfLines={1}>{ticket.title}</Text><Text style={styles.meta}>{ticket.issue_type || 'Support'} · {new Date(ticket.created_at).toLocaleDateString('en-IN')}</Text></View><Text style={styles.status}>{statusLabel[ticket.status]}</Text></View><Text style={styles.ticketDesc} numberOfLines={3}>{ticket.description}</Text></View>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#0D0D0D'}, header:{minHeight:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:'#242424'}, back:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#171717',borderWidth:1,borderColor:'#2A2A2A'},headerTitle:{fontSize:17,fontWeight:'800',color:'#FFF'},spacer:{width:38},content:{padding:16,paddingBottom:48},hero:{backgroundColor:'#171717',borderRadius:22,padding:20,marginBottom:14,borderWidth:1,borderColor:'#2A2A2A'},heroIcon:{width:48,height:48,borderRadius:16,backgroundColor:'#242424',alignItems:'center',justifyContent:'center',marginBottom:12},heroTitle:{color:'#FFF',fontSize:21,fontWeight:'900'},heroText:{color:'#A3A3A3',fontSize:13,lineHeight:19,marginTop:6},actions:{flexDirection:'row',gap:10,marginBottom:12},actionCard:{flex:1,minHeight:145,padding:14,borderRadius:18,borderWidth:1,borderColor:'#2A2A2A',backgroundColor:'#171717'},actionIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#242424',alignItems:'center',justifyContent:'center',marginBottom:10},problemIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#291616',alignItems:'center',justifyContent:'center',marginBottom:10},actionTitle:{fontSize:14,fontWeight:'900',color:'#FFF'},actionText:{fontSize:11,lineHeight:16,color:'#A3A3A3',marginTop:5},form:{borderRadius:18,borderWidth:1,borderColor:'#2A2A2A',backgroundColor:'#171717',padding:16,marginBottom:12},formTitle:{fontSize:16,fontWeight:'900',color:'#FFF',marginBottom:12},input:{minHeight:48,borderWidth:1,borderColor:'#3A3A3A',borderRadius:13,paddingHorizontal:13,color:'#FFF',backgroundColor:'#0D0D0D',fontSize:14,marginBottom:10},textarea:{minHeight:120,paddingTop:13},formActions:{flexDirection:'row',justifyContent:'flex-end',gap:9},cancel:{minHeight:44,borderRadius:13,borderWidth:1,borderColor:'#3A3A3A',paddingHorizontal:16,alignItems:'center',justifyContent:'center'},cancelText:{fontSize:13,fontWeight:'700',color:'#D4D4D4'},submit:{minHeight:44,borderRadius:13,paddingHorizontal:16,backgroundColor:'#A8E63A',flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},submitText:{fontSize:13,fontWeight:'900',color:'#0D0D0D'},contact:{minHeight:68,borderRadius:18,borderWidth:1,borderColor:'#2A2A2A',backgroundColor:'#171717',padding:14,flexDirection:'row',alignItems:'center',marginBottom:22},contactIcon:{width:40,height:40,borderRadius:12,backgroundColor:'#242424',alignItems:'center',justifyContent:'center'},contactText:{flex:1,marginLeft:12},contactLabel:{fontSize:13,fontWeight:'900',color:'#FFF'},contactValue:{fontSize:12,color:'#A3A3A3',marginTop:3},section:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},sectionTitle:{fontSize:16,fontWeight:'900',color:'#FFF'},count:{fontSize:12,color:'#A3A3A3'},loading:{padding:30,alignItems:'center'},empty:{padding:28,borderRadius:18,borderWidth:1,borderColor:'#242424',alignItems:'center'},emptyTitle:{color:'#D4D4D4',fontSize:14,fontWeight:'800',marginTop:8},emptyText:{color:'#737373',fontSize:12,marginTop:4,textAlign:'center'},ticket:{backgroundColor:'#171717',borderRadius:16,borderWidth:1,borderColor:'#2A2A2A',padding:14,marginBottom:10},ticketTop:{flexDirection:'row',alignItems:'flex-start',gap:8},ticketMain:{flex:1},ticketTitle:{color:'#FFF',fontSize:14,fontWeight:'800'},meta:{color:'#737373',fontSize:10,marginTop:4},status:{color:'#A8E63A',fontSize:10,fontWeight:'800'},ticketDesc:{color:'#A3A3A3',fontSize:12,lineHeight:17,marginTop:9}
});
