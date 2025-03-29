// Initialize the map centered on Portsmouth port coordinates with disabled interactions
const map = L.map('map', {
    center: [50.811864632873956, -1.0974481520177604],
    zoom: 30, // Just a placeholder, actual zoom set in setView
    dragging: true,
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    keyboard: false,
    boxZoom: false
}).setView([50.811864632873956, -1.0974481520177604], 15.5);

// Create custom panes with specific z-index values to control layering
map.createPane('ships');
map.createPane('berths');
map.getPane('ships').style.zIndex = 450;
map.getPane('berths').style.zIndex = 460; // Higher z-index than ships ensures berths appear on top

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Global storage for ship markers to enable updates
const shipMarkers = new Map(); // Using a Map to store markers by ship name

// Add berth locations
const berthLocations = {
    'Berth 4': [50.8112080, -1.0968130],
    'Berth 2': [50.8113134, -1.0945468],
    'Berth 5': [50.8136430, -1.0928250],
    'MEGCP': [50.8106950, -1.0875830]
};

// Create berth markers
for (const [name, coords] of Object.entries(berthLocations)) {
    // Add berth marker with custom pane
    L.marker(coords, {
        icon: L.divIcon({
            className: 'berth-icon',
            html: `<div style="
                background-color: #ff5533;
                width: 5px;
                height: 5px;
                border-radius: 40%;
                border: 0.5px solid white;
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        }),
        pane: 'berths' // Use the berths pane with higher z-index
    }).addTo(map)
    .bindTooltip(name, {permanent: true, direction: 'top', offset: [0, -10]});
}

// Custom ship icon function with more realistic ship shapes and increased length
function createShipIcon(ship) {
    // Scale base size based on ship size - increased width multiplier for longer ships
    const baseWidth = 40 + ship.size * 4; // Increased from 30 + ship.size * 3
    const baseHeight = 15 + ship.size * 1.5; // Height remains the same
    
    // Different shapes for different ship types
    let shipSvg = '';
    const shipColor = ship.type === 'cargo' ? '#3388ff' : ship.type === 'passenger' ? '#33bb33' : '#ff8833';
    
    if (ship.type === 'cargo') {
        // Cargo ship - rectangular with bridge at rear
        shipSvg = `
            <svg width="${baseWidth}" height="${baseHeight}" viewBox="0 0 ${baseWidth} ${baseHeight}">
                <!-- Ship hull -->
                <path d="M2,${baseHeight/2} L${baseWidth*0.15},${baseHeight*0.1} 
                L${baseWidth*0.95},${baseHeight*0.1} L${baseWidth-2},${baseHeight/2} 
                L${baseWidth*0.95},${baseHeight*0.9} L${baseWidth*0.15},${baseHeight*0.9} Z" 
                fill="${shipColor}" stroke="#000" stroke-width="1" />
                
                <!-- Bridge/superstructure -->
                <rect x="${baseWidth*0.8}" y="${baseHeight*0.2}" 
                width="${baseWidth*0.12}" height="${baseHeight*0.6}" 
                fill="#555" stroke="#000" stroke-width="0.5" />
            </svg>
        `;
    } else if (ship.type === 'passenger') {
        // Passenger ship - more curved with larger superstructure
        shipSvg = `
            <svg width="${baseWidth}" height="${baseHeight}" viewBox="0 0 ${baseWidth} ${baseHeight}">
                <!-- Ship hull -->
                <path d="M2,${baseHeight/2} Q${baseWidth*0.1},${baseHeight*0.1} ${baseWidth*0.3},${baseHeight*0.1} 
                L${baseWidth*0.8},${baseHeight*0.1} Q${baseWidth*0.95},${baseHeight*0.1} ${baseWidth-2},${baseHeight/2} 
                Q${baseWidth*0.95},${baseHeight*0.9} ${baseWidth*0.8},${baseHeight*0.9}
                L${baseWidth*0.3},${baseHeight*0.9} Q${baseWidth*0.1},${baseHeight*0.9} 2,${baseHeight/2} Z" 
                fill="${shipColor}" stroke="#000" stroke-width="1" />
                
                <!-- Passenger deck superstructure -->
                <rect x="${baseWidth*0.3}" y="${baseHeight*0.25}" 
                width="${baseWidth*0.5}" height="${baseHeight*0.5}" 
                fill="#fff" />
                
                <!-- Bridge -->
                <rect x="${baseWidth*0.7}" y="${baseHeight*0.15}" 
                width="${baseWidth*0.15}" height="${baseHeight*0.35}" 
                fill="#555" stroke="#000" stroke-width="0.5" />
            </svg>
        `;
    } else {
        // Naval/Other ships - more specialized silhouette
        shipSvg = `
            <svg width="${baseWidth}" height="${baseHeight}" viewBox="0 0 ${baseWidth} ${baseHeight}">
                <!-- Ship hull -->
                <path d="M2,${baseHeight/2} L${baseWidth*0.2},${baseHeight*0.2} 
                L${baseWidth*0.9},${baseHeight*0.2} L${baseWidth-2},${baseHeight/2} 
                L${baseWidth*0.9},${baseHeight*0.8} L${baseWidth*0.2},${baseHeight*0.8} Z" 
                fill="${shipColor}" stroke="#000" stroke-width="1" />
                
                <!-- Gun turret front -->
                <circle cx="${baseWidth*0.3}" cy="${baseHeight/2}" r="${baseHeight*0.2}" 
                fill="#555" stroke="#000" stroke-width="0.5" />
                
                <!-- Bridge structure -->
                <rect x="${baseWidth*0.5}" y="${baseHeight*0.3}" 
                width="${baseWidth*0.15}" height="${baseHeight*0.4}" 
                fill="#555" stroke="#000" stroke-width="0.5" />
                
                <!-- Rear structure -->
                <rect x="${baseWidth*0.75}" y="${baseHeight*0.35}" 
                width="${baseWidth*0.1}" height="${baseHeight*0.3}" 
                fill="#555" stroke="#000" stroke-width="0.5" />
            </svg>
        `;
    }
    
    return L.divIcon({
        className: 'ship-icon',
        html: `<div style="transform: rotate(${ship.rotation}deg); 
                     transform-origin: center center;">
                ${shipSvg}
              </div>`,
        iconSize: [baseWidth, baseHeight],
        iconAnchor: [baseWidth/2, baseHeight/2]
    });
}

// Update ship markers based on new data
function updateShips(ships) {
    if (!ships || !Array.isArray(ships)) {
        console.error('Ships data not found or invalid!');
        return;
    }
    
    // Get current ship names from the new data
    const currentShipNames = new Set(ships.map(ship => ship.name));
    
    // Remove ships that are no longer in the data
    for (const [shipName, marker] of shipMarkers.entries()) {
        if (!currentShipNames.has(shipName)) {
            marker.remove();
            shipMarkers.delete(shipName);
            console.log(`Ship removed: ${shipName}`);
        }
    }
    
    // Update existing ships or add new ones
    ships.forEach(ship => {
        if (shipMarkers.has(ship.name)) {
            // Ship exists - update its position and properties
            const marker = shipMarkers.get(ship.name);
            
            // Update position if it changed
            const newLatLng = L.latLng(ship.latitude, ship.longitude);
            if (!marker.getLatLng().equals(newLatLng)) {
                marker.setLatLng(newLatLng);
                console.log(`Ship moved: ${ship.name}`);
            }
            
            // Update icon if properties changed
            marker.setIcon(createShipIcon(ship));
            
            // Update popup content
            marker.setPopupContent(`
                <div class="ship-info">
                    <h3>${ship.name}</h3>
                    <p><strong>Type:</strong> ${ship.type}</p>
                    <p><strong>Size:</strong> ${ship.size} units</p>
                    <p><strong>Heading:</strong> ${ship.rotation}°</p>
                    <p><strong>Status:</strong> ${ship.status}</p>
                </div>
            `);
        } else {
            // New ship - add it to the map with the ships pane
            const marker = L.marker([ship.latitude, ship.longitude], {
                icon: createShipIcon(ship),
                title: ship.name,
                pane: 'ships' // Use the ships pane with lower z-index
            }).addTo(map);
            
            // Add popup with ship information
            marker.bindPopup(`
                <div class="ship-info">
                    <h3>${ship.name}</h3>
                    <p><strong>Type:</strong> ${ship.type}</p>
                    <p><strong>Size:</strong> ${ship.size} units</p>
                    <p><strong>Heading:</strong> ${ship.rotation}°</p>
                    <p><strong>Status:</strong> ${ship.status}</p>
                </div>
            `);
            
            // Store the new marker
            shipMarkers.set(ship.name, marker);
            console.log(`New ship added: ${ship.name}`);
        }
    });
}

// Function to update berth status indicators based on ship data
function updateBerthStatus(ships) {
    // Extract berth occupancy from ship data
    const occupiedBerths = {};
    
    ships.forEach(ship => {
        if (ship.status && ship.status.includes('Berth')) {
            // Extract berth number from status like "Docked at Berth 4"
            const berthMatch = ship.status.match(/Berth\s+(\d+)/);
            if (berthMatch && berthMatch[1]) {
                const berthNumber = berthMatch[1];
                occupiedBerths[berthNumber] = {
                    shipName: ship.name,
                    shipType: ship.type
                };
            }
        }
    });
    
    // Update ONLY the berth occupancy buttons in the dedicated berth status card
    const berthButtons = document.querySelectorAll('.berth-status-container .berth-status-button');
    if (!berthButtons.length) return; // Skip if visualization isn't on page
    
    // Update the berth status buttons in the visualization
    berthButtons.forEach(button => {
        const berthName = button.querySelector('.berth-name').textContent;
        const berthNumber = berthName.replace('Berth ', '');
        const statusElement = button.querySelector('.berth-status');
        
        // Remove all previous status classes
        button.classList.remove('occupied', 'available', 'maintenance', 'reserved');
        
        if (occupiedBerths[berthNumber]) {
            // Berth is occupied
            button.classList.add('occupied');
            statusElement.textContent = `Occupied by ${occupiedBerths[berthNumber].shipName}`;
        } else {
            // Berth is available
            button.classList.add('available');
            statusElement.textContent = 'Available';
        }
    });
}

// Setup legend
function setupLegend() {
    const legend = L.control({position: 'bottomright'});
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `
            <h4>Ship Types</h4>
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <svg width="24" height="12" viewBox="0 0 24 12" style="position: relative; z-index: 0;">
            <path d="M1,6 L4,1 L20,1 L23,6 L20,11 L4,11 Z" fill="#3388ff" stroke="#000" stroke-width="0.5" />
            <rect x="18" y="2" width="3" height="8" fill="#555" stroke="#000" stroke-width="0.3" />
            </svg>
            <span style="margin-left: 8px;">Cargo</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <svg width="24" height="12" viewBox="0 0 24 12" style="position: relative; z-index: 0;">
            <path d="M1,6 Q2.5,1 7,1 L17,1 Q21.5,1 23,6 Q21.5,11 17,11 L7,11 Q2.5,11 1,6 Z" fill="#33bb33" stroke="#000" stroke-width="0.5" />
            <rect x="7" y="3" width="10" height="6" fill="#fff" />
            </svg>
            <span style="margin-left: 8px;">Passenger</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <svg width="24" height="12" viewBox="0 0 24 12" style="position: relative; z-index: 0;">
            <path d="M1,6 L5,2 L19,2 L23,6 L19,10 L5,10 Z" fill="#ff8833" stroke="#000" stroke-width="0.5" />
            <circle cx="8" cy="6" r="2" fill="#555" stroke="#000" stroke-width="0.3" />
            <rect x="12" y="4" width="4" height="4" fill="#555" stroke="#000" stroke-width="0.3" />
            </svg>
            <span style="margin-left: 8px;">Other</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <div style="background-color: #ff5533; width: 5px; height: 5px; border-radius: 50%; border: 2px solid white; position: relative; z-index: 0;"></div>
            <span style="margin-left: 8px;">Berths</span>
            </div>
            <p>Last update: <span id="update-time">-</span></p>
        `;
        return div;
    };
    legend.addTo(map);
}

// Function to fetch ship data from API
function fetchShipData() {
    // Update the last update time in the legend
    const updateTimeElement = document.getElementById('update-time');
    if (updateTimeElement) {
        const now = new Date();
        updateTimeElement.textContent = now.toLocaleTimeString();
    }
    
    // Use API endpoint now that CORS is fixed
    fetch('http://localhost:2070/api/ship_info')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Extract the ships array
            let shipsArray = Array.isArray(data) ? data : (data.ships || []);
            
            // Map API properties to our expected format
            shipsArray = shipsArray.map(ship => {
                // Map ship type to our categories
                let mappedType = 'other';
                if (['FREIGHTER', 'CARGO', 'CONTAINER', 'BULK CARRIER'].includes(ship.type)) {
                    mappedType = 'cargo';
                } else if (['CRUISE', 'PASSENGER', 'FERRY'].includes(ship.type)) {
                    mappedType = 'passenger';
                }
                
                // Create standardized ship object
                return {
                    name: ship.name,
                    // Map API type to our simplified types
                    type: mappedType,
                    // Handle different coordinate property names
                    latitude: ship.latitude || ship.lat,
                    longitude: ship.longitude || ship.long,
                    // Handle different rotation property
                    rotation: ship.rotation || ship.bearing || 0,
                    // Default size based on ship type
                    size: ship.size || (mappedType === 'cargo' ? 8 : mappedType === 'passenger' ? 6 : 5),
                    // Default status if not provided
                    status: ship.status || 'At sea'
                };
            });
            
            console.log(`Processing ${shipsArray.length} ships from API`);
            
            // Update the map with ships
            updateShips(shipsArray);
            
            // Note: Removed berth status update as per request
            // The AQI and CO2 buttons remain hardcoded in the HTML
        })
        .catch(error => {
            console.error('Error loading ships data:', error);
            // Use a fallback if needed
            fetch('data/ships.json')
                .then(response => response.json())
                .then(data => {
                    console.log('Using fallback data source');
                    updateShips(data);
                    // Note: Removed berth status update as per request
                })
                .catch(fallbackError => console.error('Fallback data also failed:', fallbackError));
        });
}

// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up the legend
    setupLegend();
    
    // Initial data fetch
    fetchShipData();
    
    // Set up periodic data updates (every 30 seconds)
    setInterval(fetchShipData, 10000);
    
    // Add a status message
    console.log('Map initialized. Ship data will refresh every 30 seconds.');
});