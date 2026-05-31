"""
PlantCare ML Model Trainer
Trains two models:
1. health_classifier - predicts plant health label (Random Forest)
2. water_regressor   - predicts recommended watering interval (days)
Run once: python train_model.py
"""
import pandas as pd
import numpy as np
import pickle, os
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, mean_absolute_error, r2_score

CSV = os.path.join(os.path.dirname(__file__), '../dataset/plant_health_dataset.csv')
df = pd.read_csv(CSV)

# ── Encode categoricals ──
le_species  = LabelEncoder().fit(df['species'])
le_location = LabelEncoder().fit(df['location'])
le_season   = LabelEncoder().fit(df['season'])
le_health   = LabelEncoder().fit(df['health_label'])

df['species_enc']  = le_species.transform(df['species'])
df['location_enc'] = le_location.transform(df['location'])
df['season_enc']   = le_season.transform(df['season'])

FEATURES = ['species_enc','location_enc','season_enc',
            'temperature_c','humidity_pct','soil_moisture_pct',
            'days_since_watered','missed_waterings',
            'light_hours_daily','pot_has_drainage']

X = df[FEATURES]

# ── 1. Health Classifier ──
y_cls = le_health.transform(df['health_label'])
X_tr, X_te, y_tr, y_te = train_test_split(X, y_cls, test_size=0.2, random_state=42, stratify=y_cls)
clf = RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42, class_weight='balanced')
clf.fit(X_tr, y_tr)
y_pred = clf.predict(X_te)
print("=== Health Classifier ===")
print(classification_report(y_te, y_pred, target_names=le_health.classes_))
cv = cross_val_score(clf, X, y_cls, cv=5, scoring='f1_weighted')
print(f"CV F1 (weighted): {cv.mean():.3f} ± {cv.std():.3f}\n")

# ── 2. Watering Regressor ──
y_reg = df['recommended_water_days'].values
X_tr2, X_te2, y_tr2, y_te2 = train_test_split(X, y_reg, test_size=0.2, random_state=42)
reg = RandomForestRegressor(n_estimators=150, max_depth=12, random_state=42)
reg.fit(X_tr2, y_tr2)
y_pred2 = reg.predict(X_te2)
print("=== Watering Regressor ===")
print(f"MAE: {mean_absolute_error(y_te2, y_pred2):.2f} days")
print(f"R²:  {r2_score(y_te2, y_pred2):.3f}\n")

# ── Save models + encoders ──
bundle = {
    'clf': clf,
    'reg': reg,
    'le_species':  le_species,
    'le_location': le_location,
    'le_season':   le_season,
    'le_health':   le_health,
    'features':    FEATURES
}
with open(os.path.join(os.path.dirname(__file__), 'plant_ml_models.pkl'), 'wb') as f:
    pickle.dump(bundle, f)
print("✅ Models saved to plant_ml_models.pkl")
