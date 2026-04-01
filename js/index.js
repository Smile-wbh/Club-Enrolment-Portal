// JavaScript Document
window.onload=function(){
// Carousel behavior
// Index of the currently focused item
var current_index=0;
// 5000 milliseconds = 5 seconds
var timer=window.setInterval(autoChange, 5000);
// Collect all carousel buttons
var button_li=document.getElementById("button").getElementsByTagName("li");
// Collect all banner slides
var pic_div=document.getElementById("banner_pic").getElementsByTagName("div");
// Bind hover behavior
for(var i=0;i<button_li.length;i++){
	// Mouse enter
	button_li[i].onmouseover=function(){
		// Pause auto rotation if the timer exists
		if(timer){
			clearInterval(timer);
		}
		// Update the active slide
		for(var j=0;j<pic_div.length;j++){
			// Show the currently selected slide
			if(button_li[j]==this){
				current_index=j; // Start from the selected index
				button_li[j].className="current";
				pic_div[j].className="current";
			}else{
				// Reset every other item
				pic_div[j].className="pic";
				button_li[j].className="but";
			}
		}
	}
	// Mouse leave
	button_li[i].onmouseout=function(){
		// Resume auto rotation
		timer=setInterval(autoChange,5000);			
	}
}
function autoChange(){
	// Move to the next slide
	++current_index;
	// Loop back to the first slide when reaching the end
	if (current_index==button_li.length) {
		current_index=0;
	}
	for(var i=0;i<button_li.length;i++){
		if(i==current_index){
			button_li[i].className="current";
			pic_div[i].className="current";
		}else{
			button_li[i].className="but";
			pic_div[i].className="pic";
		}
	}
	}
}
