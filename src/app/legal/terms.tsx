import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const sections = [
  ['1. About These Terms', 'These terms govern use of the RivoCity Rider application and related delivery services. By registering or accepting a delivery assignment, you agree. RivoCity is currently a platform/brand and is not represented as a separately incorporated company.'],
  ['2. Service Area and Account', 'RivoCity is currently operating in Baramati, Maharashtra, India. Provide truthful personal, contact, vehicle and payment details, keep them updated and protect your account credentials. Account approval and assignment availability are subject to verification and operational requirements.'],
  ['3. Delivery Partner Role', '“Delivery Partner” describes the delivery function within the Platform. The label alone does not determine whether a person is an employee, contractor or has another legal status. That question is governed by applicable law and the actual working arrangement.'],
  ['4. Legal and Vehicle Compliance', 'Comply with applicable traffic and transport laws and maintain the licence, vehicle registration, insurance, permits and other documents required for the vehicle and delivery activity you undertake. Do not use an unsafe or legally non-compliant vehicle.'],
  ['5. Assignments and Delivery Conduct', 'Accept and complete assignments in accordance with instructions shown in the app or communicated by authorised support. Handle orders with reasonable care, follow safe routes and traffic rules, communicate professionally, and promptly report delays, accidents, damage or failed delivery.'],
  ['6. Customer Information and OTP', 'Use customer names, phone numbers, addresses and order details only to complete the assigned delivery or resolve a legitimate order issue. Do not retain, disclose or use this information for personal purposes or marketing. Where an OTP is required, enter it only after handover as instructed.'],
  ['7. Cash and Order Handling', 'Where an assignment requires cash collection, collect only the amount shown or instructed in the app, record it accurately and follow the applicable cash handover and reconciliation process. Do not collect unauthorised fees or mark an order complete inaccurately.'],
  ['8. Payments and Operational Arrangements', 'Applicable delivery compensation, payment methods, settlement timing, assignment availability, service areas and operational procedures will be communicated separately during onboarding or through the Platform. Do not assume a fixed amount or payment schedule unless expressly confirmed.'],
  ['9. Safety and Prohibited Conduct', 'Do not drive dangerously, operate while impaired, harass or discriminate against users, falsify delivery status, misuse cash or customer information, manipulate app activity, or engage in fraud, threats or unlawful conduct. Report safety incidents and emergencies promptly.'],
  ['10. Suspension and Deactivation', 'Access or assignments may be restricted or suspended for safety concerns, suspected fraud, legal or document non-compliance, misuse of customer information or repeated violations. Any review or outstanding payment will be handled subject to verification, applicable arrangements and law.'],
  ['11. Privacy', 'Personal information is handled under the applicable Privacy Policy and law. Protect information accessed through the app and use it only for legitimate delivery purposes.'],
  ['12. Liability and Changes', 'The app is provided subject to availability and delivery times may vary. Nothing in these terms excludes rights or liability that cannot lawfully be excluded. RivoCity may update these terms and publish the updated date; changes are subject to applicable law.'],
  ['13. Governing Law and Contact', 'These terms are governed by the laws of India. Subject to mandatory law and applicable jurisdiction rules, competent courts in Maharashtra will have jurisdiction. Contact support@rivocity.com.'],
];
export default function RiderTermsScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#0D0D0D" /></Pressable>
      <Text style={styles.headerTitle}>Rider Terms & Conditions</Text><View style={{ width: 36 }} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.lastUpdated}>Last updated: 30 October 2026</Text>
      {sections.map(([title, body]) => <View key={title} style={styles.section}><Text style={styles.sectionHeading}>{title}</Text><Text style={styles.paragraph}>{body}</Text></View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EAEFF3' },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EAEFF3' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  content: { padding: 20, paddingBottom: 40 },
  lastUpdated: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 8 },
  section: { marginTop: 18 },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#0D0D0D', marginBottom: 6 },
  paragraph: { fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '400' },
});
