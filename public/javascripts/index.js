$(function(){
	
	//Randomly update the gadget numbers
	var counter = 0;

	setInterval(function() {
		var gadget = Math.floor(Math.random() * 3);

		document.getElementById('gadgets')
			.getElementsByTagName('a')[gadget]
			.getElementsByTagName('strong')[0]
			.innerHTML = counter;
		
		counter += Math.floor(Math.random() * 4);

		while (counter > 20)
			counter = Math.floor(Math.random() * 5);
	}, 2000);

	// Gadget Tooltips
	$('#gadgets a').mouseenter(function() {
			var clicked = $(this).attr('id'); // what was clicked
			var selected = $('#gadgets a span.selected').parent().attr('id'); // what is selected
			
			// hide all selected tooltips
			$('#gadgets a span.selected').removeClass("selected").stop(true).animate({'opacity':'0'}, 200);

			if ( selected != clicked) {
				$('#' + clicked + ' span').addClass("selected").stop(true).animate({'opacity':'1'}, 200);
			}
			
			return false;
		}
	).mouseleave(function() {
		$(this).find('span').stop(true).animate({ opacity: 0 }, 200);
	}).click(function() {
		return false;
	});
	
	if ($('input[name=email]').val() === '')
		$('input[name=email]').focus();
	else
		$('input[name=password]').focus();
});