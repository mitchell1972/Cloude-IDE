import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import json

def setup_matplotlib_for_plotting():
    """
    Setup matplotlib and seaborn for plotting with proper configuration.
    Call this function before creating any plots to ensure proper rendering.
    """
    import warnings
    import matplotlib.pyplot as plt
    import seaborn as sns

    # Ensure warnings are printed
    warnings.filterwarnings('default')  # Show all warnings

    # Configure matplotlib for non-interactive mode
    plt.switch_backend("Agg")

    # Set chart style
    plt.style.use("seaborn-v0_8")
    sns.set_palette("husl")

    # Configure platform-appropriate fonts for cross-platform compatibility
    # Must be set after style.use, otherwise will be overridden by style configuration
    plt.rcParams["font.sans-serif"] = ["Noto Sans CJK SC", "WenQuanYi Zen Hei", "PingFang SC", "Arial Unicode MS", "Hiragino Sans GB"]
    plt.rcParams["axes.unicode_minus"] = False

# Initialize matplotlib
setup_matplotlib_for_plotting()

# Financial model data
years = [2025, 2026, 2027, 2028, 2029]

# User growth projections (conservative estimates)
user_data = {
    'Free Users': [10000, 35000, 85000, 175000, 325000],
    'Pro Users': [500, 2500, 8500, 21000, 45000],
    'Team Users': [50, 400, 1800, 5200, 12500],
    'Enterprise Users': [5, 35, 150, 420, 1000]
}

# Revenue projections ($M)
revenue_data = {
    'Subscription Revenue': [0.8, 4.2, 13.5, 32.8, 68.2],
    'Usage-Based Revenue': [0.1, 0.7, 2.4, 6.1, 13.6],
    'Enterprise Services': [0.1, 0.4, 1.5, 3.9, 8.9],
    'Total Revenue': [1.0, 5.3, 17.4, 42.8, 90.7]
}

# Create comprehensive financial visualizations
fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
fig.suptitle('Cloud IDE Platform - 5-Year Financial Projections', fontsize=16, fontweight='bold')

# 1. User Growth Projection
user_df = pd.DataFrame(user_data, index=years)
user_df.plot(kind='bar', ax=ax1, width=0.8)
ax1.set_title('User Growth by Tier (2025-2029)')
ax1.set_xlabel('Year')
ax1.set_ylabel('Number of Users')
ax1.legend(title='User Tiers', bbox_to_anchor=(1.05, 1), loc='upper left')
ax1.tick_params(axis='x', rotation=0)

# Format y-axis with thousands separator
ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x:,.0f}'))

# 2. Revenue Growth by Stream
revenue_df = pd.DataFrame({k: v for k, v in revenue_data.items() if k != 'Total Revenue'}, index=years)
revenue_df.plot(kind='area', ax=ax2, alpha=0.7)
ax2.set_title('Revenue Growth by Stream ($M)')
ax2.set_xlabel('Year')
ax2.set_ylabel('Revenue (Millions USD)')
ax2.legend(title='Revenue Streams', bbox_to_anchor=(1.05, 1), loc='upper left')

# 3. Total Revenue Growth with Growth Rate
ax3_twin = ax3.twinx()
bars = ax3.bar(years, revenue_data['Total Revenue'], color='steelblue', alpha=0.7, label='Total Revenue ($M)')
ax3.set_title('Total Revenue Growth with Year-over-Year Growth Rate')
ax3.set_xlabel('Year')
ax3.set_ylabel('Total Revenue (Millions USD)', color='steelblue')

# Calculate and plot growth rates
growth_rates = [0] + [((revenue_data['Total Revenue'][i] / revenue_data['Total Revenue'][i-1]) - 1) * 100 
                      for i in range(1, len(revenue_data['Total Revenue']))]

line = ax3_twin.plot(years, growth_rates, color='red', marker='o', linewidth=2, label='YoY Growth Rate (%)')
ax3_twin.set_ylabel('Growth Rate (%)', color='red')
ax3_twin.tick_params(axis='y', labelcolor='red')

# Add value labels on bars
for i, (year, revenue) in enumerate(zip(years, revenue_data['Total Revenue'])):
    ax3.text(year, revenue + 1, f'${revenue:.1f}M', ha='center', va='bottom', fontweight='bold')
    if i > 0:
        ax3_twin.text(year, growth_rates[i] + 10, f'{growth_rates[i]:.0f}%', ha='center', va='bottom', 
                     color='red', fontweight='bold')

# 4. Market Penetration Analysis
market_size = [1480, 1517, 1554, 1593, 1632]  # Market size in millions
penetration_rates = [(rev/market)*100 for rev, market in zip(revenue_data['Total Revenue'], market_size)]

ax4.plot(years, penetration_rates, marker='o', linewidth=3, markersize=8, color='green')
ax4.fill_between(years, penetration_rates, alpha=0.3, color='green')
ax4.set_title('Market Penetration Rate')
ax4.set_xlabel('Year')
ax4.set_ylabel('Market Penetration (%)')
ax4.grid(True, alpha=0.3)

# Add percentage labels
for year, rate in zip(years, penetration_rates):
    ax4.text(year, rate + 0.1, f'{rate:.2f}%', ha='center', va='bottom', fontweight='bold')

plt.tight_layout()
plt.savefig('charts/financial_projections.png', dpi=300, bbox_inches='tight')
plt.close()

# Create customer acquisition cost and lifetime value analysis
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle('Customer Economics Analysis', fontsize=16, fontweight='bold')

# Customer tiers for analysis
tiers = ['Pro', 'Team', 'Enterprise']
cac_values = [85, 245, 1200]
ltv_values = [285, 936, 8940]
ltv_cac_ratios = [ltv/cac for ltv, cac in zip(ltv_values, cac_values)]

# 1. CAC vs LTV by tier
x_pos = np.arange(len(tiers))
width = 0.35

bars1 = ax1.bar(x_pos - width/2, cac_values, width, label='Customer Acquisition Cost', color='coral', alpha=0.8)
bars2 = ax1.bar(x_pos + width/2, ltv_values, width, label='Customer Lifetime Value', color='skyblue', alpha=0.8)

ax1.set_title('Customer Acquisition Cost vs Lifetime Value')
ax1.set_xlabel('Customer Tier')
ax1.set_ylabel('Value (USD)')
ax1.set_xticks(x_pos)
ax1.set_xticklabels(tiers)
ax1.legend()
ax1.set_yscale('log')  # Log scale due to large differences

# Add value labels
for bar in bars1:
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height * 1.05, f'${height:.0f}',
             ha='center', va='bottom', fontsize=10, fontweight='bold')

for bar in bars2:
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height * 1.05, f'${height:.0f}',
             ha='center', va='bottom', fontsize=10, fontweight='bold')

# 2. LTV/CAC Ratios
colors = ['red' if ratio < 3 else 'orange' if ratio < 4 else 'green' for ratio in ltv_cac_ratios]
bars = ax2.bar(tiers, ltv_cac_ratios, color=colors, alpha=0.8)
ax2.set_title('LTV/CAC Ratios by Customer Tier')
ax2.set_xlabel('Customer Tier')
ax2.set_ylabel('LTV/CAC Ratio')
ax2.axhline(y=3, color='red', linestyle='--', alpha=0.7, label='Minimum Viable (3:1)')
ax2.axhline(y=4, color='orange', linestyle='--', alpha=0.7, label='Good (4:1)')
ax2.axhline(y=5, color='green', linestyle='--', alpha=0.7, label='Excellent (5:1+)')
ax2.legend(loc='upper left')

# Add ratio labels
for bar, ratio in zip(bars, ltv_cac_ratios):
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height + 0.1, f'{ratio:.1f}:1',
             ha='center', va='bottom', fontsize=12, fontweight='bold')

plt.tight_layout()
plt.savefig('charts/customer_economics.png', dpi=300, bbox_inches='tight')
plt.close()

# Create competitive pricing comparison
fig, ax = plt.subplots(1, 1, figsize=(12, 8))

# Competitor pricing data
competitors = ['GitHub\nCodespaces', 'CodeSandbox\nPro', 'Replit\nCore', 'StackBlitz\nPro', 'IDE Platform\nPro']
individual_pricing = [18, 20, 20, 25, 19]  # Adjusted Codespaces to average usage
team_pricing = [39, 40, 35, 60, 39]

x_pos = np.arange(len(competitors))
width = 0.35

bars1 = ax.bar(x_pos - width/2, individual_pricing, width, label='Individual/Pro Tier', 
               color='lightcoral', alpha=0.8)
bars2 = ax.bar(x_pos + width/2, team_pricing, width, label='Team/Business Tier', 
               color='lightblue', alpha=0.8)

ax.set_title('Competitive Pricing Analysis - Monthly Subscriptions', fontsize=14, fontweight='bold')
ax.set_xlabel('Platform')
ax.set_ylabel('Monthly Price (USD)')
ax.set_xticks(x_pos)
ax.set_xticklabels(competitors, fontsize=10)
ax.legend()
ax.grid(True, alpha=0.3, axis='y')

# Add price labels
for bar in bars1:
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.5, f'${height}',
            ha='center', va='bottom', fontweight='bold')

for bar in bars2:
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.5, f'${height}',
            ha='center', va='bottom', fontweight='bold')

# Highlight our competitive positioning
ide_platform_bars = [bars1[4], bars2[4]]
for bar in ide_platform_bars:
    bar.set_edgecolor('red')
    bar.set_linewidth(3)

ax.text(4, 45, 'Competitive\nPositioning', ha='center', va='center', 
        bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7),
        fontweight='bold')

plt.tight_layout()
plt.savefig('charts/competitive_pricing.png', dpi=300, bbox_inches='tight')
plt.close()

# Save financial data for reference
financial_summary = {
    'projections': {
        'years': years,
        'user_growth': user_data,
        'revenue_breakdown': revenue_data,
        'market_penetration': penetration_rates
    },
    'unit_economics': {
        'tiers': tiers,
        'customer_acquisition_cost': cac_values,
        'customer_lifetime_value': ltv_values,
        'ltv_cac_ratios': ltv_cac_ratios
    },
    'competitive_analysis': {
        'competitors': competitors,
        'individual_pricing': individual_pricing,
        'team_pricing': team_pricing
    }
}

with open('data/financial_model_data.json', 'w') as f:
    json.dump(financial_summary, f, indent=2)

print("Financial projections and visualizations created successfully!")
print("Files generated:")
print("- charts/financial_projections.png")
print("- charts/customer_economics.png") 
print("- charts/competitive_pricing.png")
print("- data/financial_model_data.json")
