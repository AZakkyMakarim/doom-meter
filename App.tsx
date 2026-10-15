import { StatusBar, StyleSheet, Text, View } from 'react-native';

function App() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Text style={styles.title}>DoomMeter</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
  },
});

export default App;
