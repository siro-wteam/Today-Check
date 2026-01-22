import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

export default function GroupScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Group</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textMain,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSub,
  },
});
