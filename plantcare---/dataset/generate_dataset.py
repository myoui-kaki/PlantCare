"""
PlantCare Dataset Generator
Simulates real-world plant care data for ML training.
Kaggle reference dataset: https://www.kaggle.com/datasets/marquis03/plants-classification
(We generate a complementary watering-health dataset aligned to our app's features)
"""
import pandas as pd
import numpy as np

np.random.seed(42)
N = 1200

species_list = [
    'Pothos', 'Snake Plant', 'Peace Lily', 'Spider Plant', 'Monstera',
    'Fiddle Leaf Fig', 'ZZ Plant', 'Aloe Vera', 'Rubber Plant', 'Cactus',
    'Boston Fern', 'Orchid', 'Bamboo Palm', 'Dracaena', 'Philodendron'
]
locations = ['Indoor - Low Light', 'Indoor - Medium Light', 'Indoor - Bright Light',
             'Outdoor - Shade', 'Outdoor - Full Sun']
seasons = ['Dry Season', 'Rainy Season']

# Base water needs per species (days between watering)
base_water_needs = {
    'Pothos': 7, 'Snake Plant': 14, 'Peace Lily': 5, 'Spider Plant': 7,
    'Monstera': 7, 'Fiddle Leaf Fig': 7, 'ZZ Plant': 14, 'Aloe Vera': 14,
    'Rubber Plant': 7, 'Cactus': 21, 'Boston Fern': 3, 'Orchid': 7,
    'Bamboo Palm': 5, 'Dracaena': 10, 'Philodendron': 7
}

rows = []
for i in range(N):
    sp = np.random.choice(species_list)
    loc = np.random.choice(locations)
    season = np.random.choice(seasons)
    temp = np.random.uniform(18, 38)
    humidity = np.random.uniform(25, 90)
    soil_moisture = np.random.uniform(0, 100)
    days_since_watered = np.random.uniform(0, 30)
    missed_waterings = np.random.randint(0, 8)
    light_hours = np.random.uniform(2, 12)
    pot_drainage = np.random.choice([0, 1], p=[0.2, 0.8])  # 1=has drainage

    base = base_water_needs[sp]

    # Determine health score (target variable)
    score = 100.0
    # Overwatering penalty
    if days_since_watered < base * 0.5 and soil_moisture > 70:
        score -= np.random.uniform(15, 35)
    # Underwatering penalty
    if days_since_watered > base * 1.5 or soil_moisture < 20:
        score -= np.random.uniform(10, 40) * (missed_waterings * 0.15 + 1)
    # Heat stress
    if temp > 35:
        score -= np.random.uniform(5, 20)
    # Low humidity for ferns/orchids
    if sp in ['Boston Fern', 'Orchid'] and humidity < 40:
        score -= np.random.uniform(10, 25)
    # No drainage
    if not pot_drainage and soil_moisture > 60:
        score -= np.random.uniform(10, 20)
    # Missed waterings compound
    score -= missed_waterings * np.random.uniform(2, 6)
    # Seasonal adjustment
    if season == 'Dry Season' and days_since_watered > base:
        score -= np.random.uniform(5, 15)

    score = np.clip(score + np.random.normal(0, 5), 0, 100)

    # Health label from score
    if score >= 75:
        health = 'Healthy'
    elif score >= 50:
        health = 'Needs Attention'
    else:
        health = 'At Risk'

    # Recommended watering days
    rec_water = base
    if temp > 32 or season == 'Dry Season':
        rec_water = max(1, base - 2)
    if season == 'Rainy Season' or humidity > 75:
        rec_water = base + 2

    rows.append({
        'species': sp,
        'location': loc,
        'season': season,
        'temperature_c': round(temp, 1),
        'humidity_pct': round(humidity, 1),
        'soil_moisture_pct': round(soil_moisture, 1),
        'days_since_watered': round(days_since_watered, 1),
        'missed_waterings': missed_waterings,
        'light_hours_daily': round(light_hours, 1),
        'pot_has_drainage': pot_drainage,
        'health_score': round(score, 1),
        'health_label': health,
        'recommended_water_days': rec_water
    })

df = pd.DataFrame(rows)
df.to_csv('/home/claude/plantcare-upgraded/dataset/plant_health_dataset.csv', index=False)
print(df['health_label'].value_counts())
print(df.describe())
print(f"\nDataset saved: {len(df)} rows")
