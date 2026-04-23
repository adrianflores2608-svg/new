"""
All major US cities grouped by state for exhaustive lead coverage.
"""

US_CITIES = [
    # Alabama
    "Birmingham, AL", "Montgomery, AL", "Huntsville, AL", "Mobile, AL", "Tuscaloosa, AL",
    # Alaska
    "Anchorage, AK", "Fairbanks, AK", "Juneau, AK",
    # Arizona
    "Phoenix, AZ", "Tucson, AZ", "Mesa, AZ", "Chandler, AZ", "Scottsdale, AZ",
    "Glendale, AZ", "Gilbert, AZ", "Tempe, AZ", "Peoria, AZ", "Surprise, AZ",
    # Arkansas
    "Little Rock, AR", "Fort Smith, AR", "Fayetteville, AR", "Springdale, AR",
    # California
    "Los Angeles, CA", "San Diego, CA", "San Jose, CA", "San Francisco, CA",
    "Fresno, CA", "Sacramento, CA", "Long Beach, CA", "Oakland, CA", "Bakersfield, CA",
    "Anaheim, CA", "Santa Ana, CA", "Riverside, CA", "Stockton, CA", "Chula Vista, CA",
    "Irvine, CA", "Fremont, CA", "San Bernardino, CA", "Modesto, CA", "Fontana, CA",
    "Moreno Valley, CA", "Glendale, CA", "Huntington Beach, CA", "Santa Clarita, CA",
    "Garden Grove, CA", "Oceanside, CA", "Santa Rosa, CA", "Rancho Cucamonga, CA",
    "Ontario, CA", "Lancaster, CA", "Elk Grove, CA", "Palmdale, CA", "Salinas, CA",
    "Pomona, CA", "Torrance, CA", "Pasadena, CA", "Escondido, CA", "Sunnyvale, CA",
    "Orange, CA", "Fullerton, CA", "Visalia, CA", "Concord, CA", "Roseville, CA",
    # Colorado
    "Denver, CO", "Colorado Springs, CO", "Aurora, CO", "Fort Collins, CO",
    "Lakewood, CO", "Thornton, CO", "Arvada, CO", "Westminster, CO", "Pueblo, CO",
    # Connecticut
    "Bridgeport, CT", "New Haven, CT", "Hartford, CT", "Stamford, CT", "Waterbury, CT",
    # Delaware
    "Wilmington, DE", "Dover, DE", "Newark, DE",
    # Florida
    "Jacksonville, FL", "Miami, FL", "Tampa, FL", "Orlando, FL", "St. Petersburg, FL",
    "Hialeah, FL", "Tallahassee, FL", "Fort Lauderdale, FL", "Port St. Lucie, FL",
    "Cape Coral, FL", "Pembroke Pines, FL", "Hollywood, FL", "Gainesville, FL",
    "Miramar, FL", "Coral Springs, FL", "Clearwater, FL", "Miami Gardens, FL",
    "Palm Bay, FL", "West Palm Beach, FL", "Lakeland, FL",
    # Georgia
    "Atlanta, GA", "Columbus, GA", "Augusta, GA", "Macon, GA", "Savannah, GA",
    "Athens, GA", "Sandy Springs, GA", "Roswell, GA", "Albany, GA",
    # Hawaii
    "Honolulu, HI", "Hilo, HI", "Kailua, HI",
    # Idaho
    "Boise, ID", "Nampa, ID", "Meridian, ID", "Idaho Falls, ID",
    # Illinois
    "Chicago, IL", "Aurora, IL", "Rockford, IL", "Joliet, IL", "Naperville, IL",
    "Springfield, IL", "Peoria, IL", "Elgin, IL", "Waukegan, IL", "Champaign, IL",
    # Indiana
    "Indianapolis, IN", "Fort Wayne, IN", "Evansville, IN", "South Bend, IN",
    "Carmel, IN", "Bloomington, IN", "Hammond, IN",
    # Iowa
    "Des Moines, IA", "Cedar Rapids, IA", "Davenport, IA", "Sioux City, IA",
    # Kansas
    "Wichita, KS", "Overland Park, KS", "Kansas City, KS", "Topeka, KS",
    # Kentucky
    "Louisville, KY", "Lexington, KY", "Bowling Green, KY", "Owensboro, KY",
    # Louisiana
    "New Orleans, LA", "Baton Rouge, LA", "Shreveport, LA", "Metairie, LA",
    "Lafayette, LA", "Lake Charles, LA",
    # Maine
    "Portland, ME", "Lewiston, ME", "Bangor, ME",
    # Maryland
    "Baltimore, MD", "Frederick, MD", "Rockville, MD", "Gaithersburg, MD",
    # Massachusetts
    "Boston, MA", "Worcester, MA", "Springfield, MA", "Lowell, MA", "Cambridge, MA",
    # Michigan
    "Detroit, MI", "Grand Rapids, MI", "Warren, MI", "Sterling Heights, MI",
    "Lansing, MI", "Ann Arbor, MI", "Flint, MI", "Dearborn, MI",
    # Minnesota
    "Minneapolis, MN", "Saint Paul, MN", "Rochester, MN", "Duluth, MN",
    # Mississippi
    "Jackson, MS", "Gulfport, MS", "Southaven, MS", "Hattiesburg, MS",
    # Missouri
    "Kansas City, MO", "Saint Louis, MO", "Springfield, MO", "Columbia, MO",
    # Montana
    "Billings, MT", "Missoula, MT", "Great Falls, MT",
    # Nebraska
    "Omaha, NE", "Lincoln, NE", "Bellevue, NE",
    # Nevada
    "Las Vegas, NV", "Henderson, NV", "Reno, NV", "North Las Vegas, NV",
    # New Hampshire
    "Manchester, NH", "Nashua, NH", "Concord, NH",
    # New Jersey
    "Newark, NJ", "Jersey City, NJ", "Paterson, NJ", "Elizabeth, NJ", "Trenton, NJ",
    # New Mexico
    "Albuquerque, NM", "Las Cruces, NM", "Rio Rancho, NM", "Santa Fe, NM",
    # New York
    "New York City, NY", "Buffalo, NY", "Rochester, NY", "Yonkers, NY", "Syracuse, NY",
    "Albany, NY", "New Rochelle, NY", "Mount Vernon, NY", "Schenectady, NY",
    # North Carolina
    "Charlotte, NC", "Raleigh, NC", "Greensboro, NC", "Durham, NC", "Winston-Salem, NC",
    "Fayetteville, NC", "Cary, NC", "Wilmington, NC", "High Point, NC",
    # North Dakota
    "Fargo, ND", "Bismarck, ND", "Grand Forks, ND",
    # Ohio
    "Columbus, OH", "Cleveland, OH", "Cincinnati, OH", "Toledo, OH", "Akron, OH",
    "Dayton, OH", "Parma, OH", "Canton, OH", "Youngstown, OH",
    # Oklahoma
    "Oklahoma City, OK", "Tulsa, OK", "Norman, OK", "Broken Arrow, OK",
    # Oregon
    "Portland, OR", "Eugene, OR", "Salem, OR", "Gresham, OR", "Hillsboro, OR",
    # Pennsylvania
    "Philadelphia, PA", "Pittsburgh, PA", "Allentown, PA", "Erie, PA",
    "Reading, PA", "Scranton, PA", "Bethlehem, PA",
    # Rhode Island
    "Providence, RI", "Cranston, RI", "Warwick, RI",
    # South Carolina
    "Columbia, SC", "Charleston, SC", "North Charleston, SC", "Greenville, SC",
    # South Dakota
    "Sioux Falls, SD", "Rapid City, SD",
    # Tennessee
    "Memphis, TN", "Nashville, TN", "Knoxville, TN", "Chattanooga, TN",
    "Clarksville, TN", "Murfreesboro, TN",
    # Texas
    "Houston, TX", "San Antonio, TX", "Dallas, TX", "Austin, TX", "Fort Worth, TX",
    "El Paso, TX", "Arlington, TX", "Corpus Christi, TX", "Plano, TX", "Laredo, TX",
    "Lubbock, TX", "Garland, TX", "Irving, TX", "Amarillo, TX", "Grand Prairie, TX",
    "Brownsville, TX", "McKinney, TX", "Frisco, TX", "Pasadena, TX", "Killeen, TX",
    "Mesquite, TX", "McAllen, TX", "Waco, TX", "Carrollton, TX", "Midland, TX",
    # Utah
    "Salt Lake City, UT", "West Valley City, UT", "Provo, UT", "West Jordan, UT",
    "Orem, UT", "Sandy, UT",
    # Vermont
    "Burlington, VT", "Essex Junction, VT",
    # Virginia
    "Virginia Beach, VA", "Norfolk, VA", "Chesapeake, VA", "Richmond, VA",
    "Newport News, VA", "Alexandria, VA", "Hampton, VA", "Roanoke, VA",
    # Washington
    "Seattle, WA", "Spokane, WA", "Tacoma, WA", "Vancouver, WA", "Bellevue, WA",
    "Kent, WA", "Everett, WA", "Renton, WA",
    # West Virginia
    "Charleston, WV", "Huntington, WV", "Morgantown, WV",
    # Wisconsin
    "Milwaukee, WI", "Madison, WI", "Green Bay, WI", "Kenosha, WI", "Racine, WI",
    # Wyoming
    "Cheyenne, WY", "Casper, WY",
]
