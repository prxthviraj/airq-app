
cd /Users/prithvirajpanth/Documents/Projects/airq-app || exit 1

source .venv/bin/activate

export CPCB_API_KEY="579b464db66ec23bdd00000187ff35ae15f546fd51c24b6409634b9b"
export REFRESH_TOKEN="your_refresh_token_here"

python3 scripts/fetch_cpcb_api.py --limit 1000 >> /Users/prithvirajpanth/Documents/Projects/airq-app/cron.log 2>&1
echo "Run completed at $(date)" >> /Users/prithvirajpanth/Documents/Projects/airq-app/cron.log
