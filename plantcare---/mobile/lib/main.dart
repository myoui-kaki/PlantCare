// ============================================================
//  PlantCare Mobile — Flutter Client
//  ITEL 305: Mobile compatibility — same Python backend serves
//  both web and mobile (dual-consumer architecture)
//
//  Setup:
//    flutter create plantcare_mobile
//    Replace lib/main.dart with this file
//    Add to pubspec.yaml dependencies:
//      http: ^1.2.0
//      shared_preferences: ^2.2.3
//      fl_chart: ^0.68.0
// ============================================================

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

// ── Config ──────────────────────────────────────────────────
const String kBaseUrl = 'https://your-backend.onrender.com'; // change to deployed URL

// ── Entry Point ──────────────────────────────────────────────
void main() {
  runApp(const PlantCareApp());
}

class PlantCareApp extends StatelessWidget {
  const PlantCareApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PlantCare',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2d6a4f)),
        useMaterial3: true,
        fontFamily: 'Roboto',
      ),
      home: const SplashScreen(),
    );
  }
}

// ── API Service ──────────────────────────────────────────────
class ApiService {
  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, String>> _authHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/api/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Login failed');
  }

  static Future<Map<String, dynamic>> register(
      String name, String email, String password) async {
    final res = await http.post(
      Uri.parse('$kBaseUrl/api/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'name': name, 'email': email, 'password': password}),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Registration failed');
  }

  static Future<Map<String, dynamic>> getDashboard() async {
    final headers = await _authHeaders();
    final res = await http.get(
      Uri.parse('$kBaseUrl/api/mobile/dashboard'),
      headers: headers,
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Failed to load dashboard');
  }

  static Future<List<dynamic>> getPlants() async {
    final headers = await _authHeaders();
    final res = await http.get(
      Uri.parse('$kBaseUrl/api/mobile/plants'),
      headers: headers,
    );
    if (res.statusCode == 200) return jsonDecode(res.body)['plants'];
    throw Exception('Failed to load plants');
  }

  static Future<Map<String, dynamic>> addPlant({
    required String name,
    String? species,
    String? location,
    int waterFreqDays = 3,
  }) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$kBaseUrl/api/plants'),
      headers: headers,
      body: jsonEncode({
        'name': name,
        'species': species,
        'location': location,
        'water_freq_days': waterFreqDays,
      }),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('Failed to add plant');
  }

  static Future<void> waterPlant(String plantId) async {
    final headers = await _authHeaders();
    await http.post(
      Uri.parse('$kBaseUrl/api/plants/$plantId/water'),
      headers: headers,
    );
  }

  static Future<void> deletePlant(String plantId) async {
    final headers = await _authHeaders();
    await http.delete(
      Uri.parse('$kBaseUrl/api/plants/$plantId'),
      headers: headers,
    );
  }

  static Future<Map<String, dynamic>> predictHealth({
    required String plantName,
    required String species,
    required String location,
    required String season,
    required double tempC,
    required double humidity,
    required double soilMoisture,
    required double daysSinceWatered,
    required int missedWaterings,
    required double lightHours,
    required bool hasDrainage,
  }) async {
    final headers = await _authHeaders();
    final res = await http.post(
      Uri.parse('$kBaseUrl/api/ml/predict'),
      headers: headers,
      body: jsonEncode({
        'plant_name': plantName,
        'species': species,
        'location': location,
        'season': season,
        'temperature_c': tempC,
        'humidity_pct': humidity,
        'soil_moisture_pct': soilMoisture,
        'days_since_watered': daysSinceWatered,
        'missed_waterings': missedWaterings,
        'light_hours_daily': lightHours,
        'pot_has_drainage': hasDrainage,
      }),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception(jsonDecode(res.body)['detail'] ?? 'Prediction failed');
  }
}

// ── Splash Screen ────────────────────────────────────────────
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    await Future.delayed(const Duration(milliseconds: 1200));
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token');
    if (!mounted) return;
    if (token != null) {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } else {
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF2d6a4f),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text('🌿', style: TextStyle(fontSize: 72)),
            SizedBox(height: 16),
            Text('PlantCare', style: TextStyle(
              fontSize: 32, fontWeight: FontWeight.bold,
              color: Colors.white, letterSpacing: 1,
            )),
            SizedBox(height: 8),
            Text('Nurture. Grow. Thrive.', style: TextStyle(color: Colors.white70, fontSize: 15)),
            SizedBox(height: 40),
            CircularProgressIndicator(color: Colors.white70, strokeWidth: 2),
          ],
        ),
      ),
    );
  }
}

// ── Login Screen ─────────────────────────────────────────────
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _loading    = false;
  String? _error;

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.login(_emailCtrl.text.trim(), _passCtrl.text);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setString('user_name', data['user']['name']);
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9F4),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 40),
              const Text('🌿 PlantCare', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF2d6a4f))),
              const SizedBox(height: 12),
              const Text('Welcome back', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF1b4332))),
              const Text('Sign in to your garden', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 32),
              _buildField('Email', _emailCtrl, false),
              const SizedBox(height: 16),
              _buildField('Password', _passCtrl, true),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ],
              const SizedBox(height: 24),
              SizedBox(width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: _loading ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2d6a4f),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                    ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                    : const Text('Sign In', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 20),
              Center(child: TextButton(
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
                child: const Text("Don't have an account? Create one", style: TextStyle(color: Color(0xFF2d6a4f))),
              )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, bool obscure) {
    return TextField(
      controller: ctrl,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        filled: true, fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFb7e4c7))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFb7e4c7))),
      ),
    );
  }
}

// ── Register Screen ──────────────────────────────────────────
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameCtrl  = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  bool _loading    = false;
  String? _error;

  Future<void> _register() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await ApiService.register(
        _nameCtrl.text.trim(), _emailCtrl.text.trim(), _passCtrl.text);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setString('user_name', data['user']['name']);
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      setState(() { _error = e.toString().replaceFirst('Exception: ', ''); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9F4),
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0,
        leading: BackButton(color: const Color(0xFF2d6a4f))),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Create account', style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: Color(0xFF1b4332))),
              const Text('Join the plant lovers community', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 32),
              TextField(controller: _nameCtrl, decoration: _dec('Full Name')),
              const SizedBox(height: 14),
              TextField(controller: _emailCtrl, decoration: _dec('Email')),
              const SizedBox(height: 14),
              TextField(controller: _passCtrl, obscureText: true, decoration: _dec('Password')),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
              ],
              const SizedBox(height: 24),
              SizedBox(width: double.infinity, height: 52,
                child: ElevatedButton(
                  onPressed: _loading ? null : _register,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2d6a4f), foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _loading
                    ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                    : const Text('Create Account', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _dec(String label) => InputDecoration(
    labelText: label, filled: true, fillColor: Colors.white,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFb7e4c7))),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFb7e4c7))),
  );
}

// ── Home Screen (tab navigator) ──────────────────────────────
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final _tabs = const [
    DashboardTab(), PlantsTab(), MLPredictTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _tabs[_tab],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        selectedItemColor: const Color(0xFF2d6a4f),
        onTap: (i) => setState(() => _tab = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.yard_outlined), label: 'Plants'),
          BottomNavigationBarItem(icon: Icon(Icons.psychology_outlined), label: 'AI Health'),
        ],
      ),
    );
  }
}

// ── Dashboard Tab ────────────────────────────────────────────
class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});
  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final d = await ApiService.getDashboard();
      setState(() { _data = d; });
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      setState(() { _loading = false; });
    }
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9F4),
      appBar: AppBar(
        title: const Text('PlantCare 🌿', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2d6a4f),
        foregroundColor: Colors.white,
        actions: [IconButton(icon: const Icon(Icons.logout), onPressed: _logout)],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF2d6a4f)))
        : _error != null
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(_error!, style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 12),
              ElevatedButton(onPressed: _load, child: const Text('Retry')),
            ]))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _greetingCard(),
                  const SizedBox(height: 16),
                  _statsRow(),
                  const SizedBox(height: 16),
                  _pendingTasks(),
                ],
              ),
            ),
    );
  }

  Widget _greetingCard() {
    final user = _data?['user'] ?? {};
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF2d6a4f),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Good day, ${user['name'] ?? ''} 👋',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 6),
        Text('Level ${user['level'] ?? 1}  •  ${user['xp'] ?? 0} XP  •  ${user['streak'] ?? 0} day streak',
          style: const TextStyle(color: Colors.white70, fontSize: 13)),
      ]),
    );
  }

  Widget _statsRow() {
    final stats = _data?['stats'] ?? {};
    return Row(children: [
      _statCard('🪴', '${stats['total_plants'] ?? 0}', 'Plants', const Color(0xFFd8f3dc)),
      const SizedBox(width: 12),
      _statCard('💧', '${stats['tasks_today'] ?? 0}', 'Need Water', const Color(0xFFe3f2fd)),
    ]);
  }

  Widget _statCard(String icon, String value, String label, Color bg) {
    return Expanded(child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(icon, style: const TextStyle(fontSize: 24)),
        const SizedBox(height: 8),
        Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1b4332))),
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ]),
    ));
  }

  Widget _pendingTasks() {
    final tasks = (_data?['stats']?['tasks_pending'] as List?) ?? [];
    if (tasks.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text("Today's Tasks", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1b4332))),
      const SizedBox(height: 8),
      ...tasks.map((t) => Card(
        child: ListTile(
          leading: const Text('💧', style: TextStyle(fontSize: 22)),
          title: Text(t['plant_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w500)),
          subtitle: const Text('Needs watering'),
          trailing: TextButton(
            onPressed: () async {
              await ApiService.waterPlant(t['plant_id']);
              _load();
            },
            child: const Text('Water ✓', style: TextStyle(color: Color(0xFF2d6a4f))),
          ),
        ),
      )),
    ]);
  }
}

// ── Plants Tab ───────────────────────────────────────────────
class PlantsTab extends StatefulWidget {
  const PlantsTab({super.key});
  @override
  State<PlantsTab> createState() => _PlantsTabState();
}

class _PlantsTabState extends State<PlantsTab> {
  List<dynamic> _plants = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final p = await ApiService.getPlants();
      setState(() => _plants = p);
    } catch (_) {}
    setState(() => _loading = false);
  }

  void _showAddDialog() {
    final nameCtrl    = TextEditingController();
    final speciesCtrl = TextEditingController();
    final locCtrl     = TextEditingController();
    showDialog(context: context, builder: (_) => AlertDialog(
      title: const Text('Add Plant 🌱'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: nameCtrl,    decoration: const InputDecoration(labelText: 'Plant Name *')),
        TextField(controller: speciesCtrl, decoration: const InputDecoration(labelText: 'Species')),
        TextField(controller: locCtrl,     decoration: const InputDecoration(labelText: 'Location')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2d6a4f), foregroundColor: Colors.white),
          onPressed: () async {
            Navigator.pop(context);
            await ApiService.addPlant(name: nameCtrl.text.trim(), species: speciesCtrl.text, location: locCtrl.text);
            _load();
          },
          child: const Text('Add'),
        ),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9F4),
      appBar: AppBar(
        title: const Text('My Plants', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2d6a4f), foregroundColor: Colors.white,
        actions: [IconButton(icon: const Icon(Icons.add), onPressed: _showAddDialog)],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF2d6a4f)))
        : _plants.isEmpty
          ? const Center(child: Text('No plants yet!\nTap + to add your first plant.', textAlign: TextAlign.center))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _plants.length,
                itemBuilder: (_, i) {
                  final p = _plants[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: ListTile(
                      leading: const Text('🪴', style: TextStyle(fontSize: 28)),
                      title: Text(p['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        '${p['species'] ?? 'Unknown species'}  •  ${p['location'] ?? ''}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(
                          icon: const Text('💧', style: TextStyle(fontSize: 20)),
                          onPressed: () async {
                            await ApiService.waterPlant(p['id']);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('${p['name']} watered! 💧')));
                            _load();
                          },
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.red),
                          onPressed: () async {
                            await ApiService.deletePlant(p['id']);
                            _load();
                          },
                        ),
                      ]),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

// ── ML Predict Tab ───────────────────────────────────────────
class MLPredictTab extends StatefulWidget {
  const MLPredictTab({super.key});
  @override
  State<MLPredictTab> createState() => _MLPredictTabState();
}

class _MLPredictTabState extends State<MLPredictTab> {
  final _nameCtrl = TextEditingController(text: 'My Plant');
  String _species  = 'Pothos';
  String _location = 'Indoor - Medium Light';
  String _season   = 'Dry Season';
  double _temp     = 28;
  double _humidity = 60;
  double _soil     = 50;
  double _light    = 6;
  double _days     = 3;
  int    _missed   = 0;
  bool   _drainage = true;
  bool   _loading  = false;
  Map<String, dynamic>? _result;

  final _speciesList  = ['Pothos','Snake Plant','Peace Lily','Spider Plant','Monstera',
                          'Fiddle Leaf Fig','ZZ Plant','Aloe Vera','Rubber Plant','Cactus',
                          'Boston Fern','Orchid','Bamboo Palm','Dracaena','Philodendron'];
  final _locationList = ['Indoor - Low Light','Indoor - Medium Light','Indoor - Bright Light',
                          'Outdoor - Shade','Outdoor - Full Sun'];

  Future<void> _predict() async {
    setState(() { _loading = true; _result = null; });
    try {
      final r = await ApiService.predictHealth(
        plantName: _nameCtrl.text,
        species: _species,
        location: _location,
        season: _season,
        tempC: _temp,
        humidity: _humidity,
        soilMoisture: _soil,
        daysSinceWatered: _days,
        missedWaterings: _missed,
        lightHours: _light,
        hasDrainage: _drainage,
      );
      setState(() => _result = r);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _loading = false);
    }
  }

  Color _healthColor(String? label) {
    if (label == 'Healthy') return const Color(0xFF52b788);
    if (label == 'At Risk') return const Color(0xFFe76f51);
    return const Color(0xFFf4a261);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9F4),
      appBar: AppBar(
        title: const Text('AI Plant Health', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF2d6a4f), foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Plant details card
          Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)), child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('🌿 Plant Details', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2d6a4f))),
              const SizedBox(height: 12),
              TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Plant Nickname', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _species,
                decoration: const InputDecoration(labelText: 'Species', border: OutlineInputBorder()),
                items: _speciesList.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                onChanged: (v) => setState(() => _species = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _location,
                decoration: const InputDecoration(labelText: 'Location', border: OutlineInputBorder()),
                items: _locationList.map((l) => DropdownMenuItem(value: l, child: Text(l, overflow: TextOverflow.ellipsis))).toList(),
                onChanged: (v) => setState(() => _location = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _season,
                decoration: const InputDecoration(labelText: 'Season', border: OutlineInputBorder()),
                items: ['Dry Season','Rainy Season'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                onChanged: (v) => setState(() => _season = v!),
              ),
            ]),
          )),
          const SizedBox(height: 12),
          // Conditions card
          Card(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)), child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('🌡️ Environment', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2d6a4f))),
              const SizedBox(height: 8),
              _slider('Temperature (°C)', _temp, 15, 45, (v) => setState(() => _temp = v)),
              _slider('Humidity (%)', _humidity, 10, 100, (v) => setState(() => _humidity = v)),
              _slider('Soil Moisture (%)', _soil, 0, 100, (v) => setState(() => _soil = v)),
              _slider('Light Hours/Day', _light, 1, 14, (v) => setState(() => _light = v)),
              _slider('Days Since Watered', _days, 0, 30, (v) => setState(() => _days = v)),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Has Drainage', style: TextStyle(fontSize: 14)),
                Switch(value: _drainage, onChanged: (v) => setState(() => _drainage = v),
                  activeColor: const Color(0xFF2d6a4f)),
              ]),
            ]),
          )),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity, height: 52,
            child: ElevatedButton.icon(
              icon: const Icon(Icons.psychology),
              label: const Text('Predict Plant Health', style: TextStyle(fontSize: 16)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2d6a4f), foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: _loading ? null : _predict,
            ),
          ),
          if (_loading) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator(color: Color(0xFF2d6a4f)))),
          if (_result != null) ...[
            const SizedBox(height: 16),
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              color: _healthColor(_result!['health_label']).withOpacity(.15),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(_result!['health_label'] == 'Healthy' ? '✅' : _result!['health_label'] == 'At Risk' ? '🚨' : '⚠️',
                      style: const TextStyle(fontSize: 32)),
                    const SizedBox(width: 12),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_result!['health_label'] ?? '', style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold,
                        color: _healthColor(_result!['health_label']))),
                      Text('${_result!['health_score']}% confidence',
                        style: const TextStyle(color: Colors.grey, fontSize: 13)),
                    ]),
                  ]),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: Colors.white.withOpacity(.6), borderRadius: BorderRadius.circular(8)),
                    child: Text('💧 Water every ${_result!['recommended_water_days']} day(s)',
                      style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF2d6a4f))),
                  ),
                  const SizedBox(height: 14),
                  const Text('AI Recommendations', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1b4332))),
                  const SizedBox(height: 8),
                  ...(_result!['advice'] as List).map((tip) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text('$tip', style: const TextStyle(fontSize: 13, height: 1.4)),
                  )),
                ]),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _slider(String label, double val, double min, double max, ValueChanged<double> onChanged) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(fontSize: 13, color: Colors.grey)),
        Text(val.toStringAsFixed(0), style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2d6a4f))),
      ]),
      Slider(value: val, min: min, max: max, activeColor: const Color(0xFF2d6a4f), onChanged: onChanged),
    ]);
  }
}
